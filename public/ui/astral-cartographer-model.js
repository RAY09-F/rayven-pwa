// Production model port of the Astral Cartographer design handoff.
export const ASTRAL_AGENT_IDS = { core: 'thor', ruby: 'jane_foster', sapphire: 'valkyrie', rose: 'hulk', gold: 'korg', amethyst: 'darcy' };
export function buildAstralCartographer(THREE, { random = Math.random } = {}) {
const mat = (name, color, o={}) => Object.assign(new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.2, ...o }), { name });
const gem = (name, color, em, i=0.9) => Object.assign(new THREE.MeshPhysicalMaterial({ color, roughness: 0, metalness: 0, transmission: 1, thickness: 0.8, ior: 2.42, dispersion: 0.35, attenuationColor: new THREE.Color(color), attenuationDistance: 1.2, clearcoat: 1, clearcoatRoughness: 0, emissive: em, emissiveIntensity: i, flatShading: true }), { name });
const M = {
  stone:   mat('dark_marble', 0x0c1424, { roughness: 0.35, metalness: 0.25 }),
  slate:   mat('navy_inlay', 0x152848, { roughness: 0.3, metalness: 0.3 }),
  brass:   mat('brass', 0xd9a54a, { roughness: 0.25, metalness: 0.85, emissive: 0x2a1a00, emissiveIntensity: 0.25 }),
  steel:   mat('hammer_steel', 0xd0dcea, { roughness: 0.22, metalness: 0.9 }),
  steelDk: mat('hammer_steel_dark', 0x4a5666, { roughness: 0.4, metalness: 0.85 }),
  leather: mat('leather_wrap', 0x3a2418, { roughness: 0.85, metalness: 0.05 }),
  holo:    Object.assign(new THREE.MeshBasicMaterial({ color: 0x3f8cff, transparent: true, opacity: 0.22, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), { name: 'hologram' }),
  holoLine:Object.assign(new THREE.MeshBasicMaterial({ color: 0x7fb8ff, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }), { name: 'hologram_line' }),
  ice:     mat('ice_rock', 0x27405e, { roughness: 0.4, metalness: 0.3, emissive: 0x0a2a5a, emissiveIntensity: 0.4, flatShading: true }),
};
const agents = [
  { key: 'ruby',     name: 'JANE FOSTER', role: 'THE SEEKER', hex: 0xff3a3a, em: 0xff0a0a, css: '#ff6a6a', bolt: 0xff7a7a, angle: 90 },
  { key: 'sapphire', name: 'VALKYRIE',    role: 'THE ROAD',   hex: 0x3a8aff, em: 0x0a4aff, css: '#6aa8ff', bolt: 0x8ac0ff, angle: 18 },
  { key: 'rose',     name: 'HULK',        role: 'THE HANDS',  hex: 0xff4ab8, em: 0xff0a8a, css: '#ff7ad0', bolt: 0xffa0e0, angle: 306 },
  { key: 'gold',     name: 'KORG',        role: 'THE WORLD',  hex: 0xffc21a, em: 0xff8c00, css: '#ffd84a', bolt: 0xffe08a, angle: 234 },
  { key: 'amethyst', name: 'DARCY',       role: 'THE KEEPER', hex: 0xa040ff, em: 0x5a00ff, css: '#c088ff', bolt: 0xd0a0ff, angle: 162 },
];

const add = (parent, name, geo, m, pos=[0,0,0], rot=[0,0,0]) => {
  const mesh = new THREE.Mesh(geo, m); mesh.name = name;
  mesh.position.set(...pos); mesh.rotation.set(...rot);
  mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
};
// Agent sigil: storm bolt — a chamfered crystal lightning bolt in the agent color with a white-hot core, live arcs crawling its edges, orbiting sparks
const BOLT_PTS = [[0.14,0.55],[-0.20,0.06],[-0.04,0.06],[-0.16,-0.55],[0.20,0.0],[0.03,0.0]];
const boltShape = new THREE.Shape(); BOLT_PTS.forEach(([x,y],i) => i ? boltShape.lineTo(x,y) : boltShape.moveTo(x,y)); boltShape.closePath();
const sigilGeo = new THREE.ExtrudeGeometry(boltShape, { depth: 0.10, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 1 }); sigilGeo.center();
const boltCoreGeo = new THREE.ExtrudeGeometry(boltShape, { depth: 0.14, bevelEnabled: false }); boltCoreGeo.center(); boltCoreGeo.scale(0.42, 0.8, 1);
const sigil = (name, color, em) => gem(name, color, em, 0.9);
const buildSigil = (parent, key, m, coreM) => {
  add(parent, `${key}_bolt`, sigilGeo, m);
  add(parent, `${key}_bolt_core`, boltCoreGeo, coreM);
  add(parent, `${key}_bolt_ring`, new THREE.TorusGeometry(0.42, 0.006, 8, 64), M.brass, [0,0,0], [0.35, 0, 0.2]);
};
// Edge sample points on the bolt outline (local space, both faces) for arc anchors
const BOLT_EDGE = []; BOLT_PTS.forEach((p, i) => { const q = BOLT_PTS[(i+1)%BOLT_PTS.length]; for (let k = 0; k < 4; k++) { const t = k/4; BOLT_EDGE.push([p[0] + (q[0]-p[0])*t, p[1] + (q[1]-p[1])*t, 0.075]); BOLT_EDGE.push([p[0] + (q[0]-p[0])*t, p[1] + (q[1]-p[1])*t, -0.075]); } });

const model = new THREE.Group(); model.name = 'astral_cartographer';
// Dais: star chart floor with brass meridians
add(model, 'dais_base', new THREE.CylinderGeometry(3.0, 3.2, 0.12, 96), M.stone, [0, 0.06, 0]);
add(model, 'dais_step', new THREE.CylinderGeometry(2.4, 2.5, 0.10, 96), M.slate, [0, 0.17, 0]);
[2.75, 2.9].forEach((r,i) => add(model, `dais_ring_${i+1}`, new THREE.TorusGeometry(r, i ? 0.012 : 0.02, 10, 160), M.brass, [0, 0.125, 0], [Math.PI/2, 0, 0]));
[1.35, 1.7, 2.1].forEach((r,i) => add(model, `dais_groove_${i+1}`, new THREE.TorusGeometry(r, 0.012, 8, 160), M.brass, [0, 0.225, 0], [Math.PI/2, 0, 0]));
for (let i = 0; i < 24; i++) { const a = i/24*Math.PI*2; add(model, `dais_stud_${i+1}`, new THREE.SphereGeometry(0.035, 12, 8), M.brass, [Math.cos(a)*2.62, 0.13, Math.sin(a)*2.62]); }
// Ice peaks at the rim
[[2.55,0.9,0.5],[2.35,-1.5,0.7],[-2.2,1.6,0.6],[-2.6,-0.7,0.45],[0.4,2.75,0.55],[-1.2,-2.5,0.5],[1.9,2.1,0.4]].forEach(([x,z,h],i) => {
  add(model, `peak_${i+1}`, new THREE.ConeGeometry(0.18 + h*0.15, h, 5, 1), M.ice, [x, 0.12 + h/2, z], [0, i*1.3, 0]);
  add(model, `peak_${i+1}_b`, new THREE.ConeGeometry(0.14, h*0.6, 4, 1), M.ice, [x + 0.22, 0.12 + h*0.3, z - 0.15], [0, i*0.7, 0]);
});
// Pedestal: three stacked drums with brass bands
add(model, 'pedestal_drum_1', new THREE.CylinderGeometry(1.15, 1.2, 0.22, 64), M.stone, [0, 0.33, 0]);
add(model, 'pedestal_band_1', new THREE.TorusGeometry(1.17, 0.02, 10, 96), M.brass, [0, 0.45, 0], [Math.PI/2, 0, 0]);
add(model, 'pedestal_drum_2', new THREE.CylinderGeometry(0.95, 1.0, 0.24, 64), M.slate, [0, 0.56, 0]);
add(model, 'pedestal_band_2', new THREE.TorusGeometry(0.97, 0.02, 10, 96), M.brass, [0, 0.69, 0], [Math.PI/2, 0, 0]);
add(model, 'pedestal_drum_3', new THREE.CylinderGeometry(0.78, 0.82, 0.22, 64), M.stone, [0, 0.79, 0]);
add(model, 'pedestal_cap', new THREE.CylinderGeometry(0.7, 0.78, 0.06, 64), M.brass, [0, 0.93, 0]);
for (let i = 0; i < 12; i++) { const a = i/12*Math.PI*2; add(model, `pedestal_rib_${i+1}`, new THREE.BoxGeometry(0.05, 0.6, 0.05), M.brass, [Math.cos(a)*1.0, 0.6, Math.sin(a)*1.0], [0, -a, 0]); }

// Armillary + hammer (floats)
const core = new THREE.Group(); core.name = 'core'; core.position.y = 2.0; model.add(core);
const armillary = new THREE.Group(); armillary.name = 'armillary'; core.add(armillary);
const ringDefs = [[1.2, 0.04, [Math.PI/2 + 0.45, 0, 0.3]], [1.05, 0.035, [Math.PI/2 - 0.3, 0, -0.9]], [0.9, 0.03, [0.2, 0.6, 0]], [1.3, 0.025, [Math.PI/2, 0, 0]]];
const rings = ringDefs.map(([r, t, rot], i) => {
  const g = new THREE.Group(); g.rotation.set(...rot); g.name = `ring_${i+1}`;
  add(g, `armillary_ring_${i+1}`, new THREE.TorusGeometry(r, t, 12, 128), M.brass);
  for (let k = 0; k < 4; k++) { const a = k/4*Math.PI*2; add(g, `ring_${i+1}_star_${k+1}`, new THREE.ConeGeometry(0.05, 0.16, 4, 1), M.brass, [Math.cos(a)*r, Math.sin(a)*r, 0], [0, 0, a - Math.PI/2]); }
  armillary.add(g); return g;
});
// (no central axis rod — the hammer floats free inside the sphere)
// Mjolnir-style hammer: chamfered squat head, engraved bands, raised strike faces, short wrapped haft with loop
const hammer = new THREE.Group(); hammer.name = 'hammer'; hammer.rotation.set(0.15, 0.6, -0.65); hammer.scale.setScalar(1.45); core.add(hammer);
const headShape = new THREE.Shape(); const HW = 0.30, HH = 0.17, HB = 0.03;
headShape.moveTo(-HW+HB, -HH); headShape.lineTo(HW-HB, -HH); headShape.lineTo(HW, -HH+HB); headShape.lineTo(HW, HH-HB); headShape.lineTo(HW-HB, HH); headShape.lineTo(-HW+HB, HH); headShape.lineTo(-HW, HH-HB); headShape.lineTo(-HW, -HH+HB); headShape.closePath();
const headGeo = new THREE.ExtrudeGeometry(headShape, { depth: 0.36, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.025, bevelSegments: 3, curveSegments: 4 }); headGeo.center();
add(hammer, 'hammer_head', headGeo, M.steel);
[0.19, -0.19].forEach((x, i) => add(hammer, `hammer_band_${i+1}`, new THREE.BoxGeometry(0.035, 0.365, 0.415), M.steelDk, [x, 0, 0]));
add(hammer, 'hammer_band_top', new THREE.BoxGeometry(0.64, 0.02, 0.06), M.steelDk, [0, 0.18, 0]);
[0.335, -0.335].forEach((x, i) => { add(hammer, `hammer_face_${i+1}`, new THREE.BoxGeometry(0.03, 0.30, 0.34), M.steel, [x, 0, 0]); add(hammer, `hammer_face_rim_${i+1}`, new THREE.BoxGeometry(0.012, 0.33, 0.37), M.steelDk, [x - Math.sign(x)*0.02, 0, 0]); });
const runeMat = mat('rune_glow', 0xbfe0ff, { emissive: 0x4a9aff, emissiveIntensity: 1.5, roughness: 0.3 });
const rune = add(hammer, 'hammer_rune', new THREE.TorusGeometry(0.075, 0.008, 8, 48), runeMat, [0, 0, 0.21], [0, 0, 0]);
for (let i = 0; i < 3; i++) { const a = i/3*Math.PI*2 + Math.PI/2; add(hammer, `hammer_rune_knot_${i+1}`, new THREE.TorusGeometry(0.045, 0.006, 8, 32), runeMat, [Math.cos(a)*0.035, Math.sin(a)*0.035, 0.212], [0, 0, 0]); }
add(hammer, 'hammer_rune_back', new THREE.TorusGeometry(0.075, 0.008, 8, 48), runeMat, [0, 0, -0.21]);
add(hammer, 'hammer_collar', new THREE.CylinderGeometry(0.08, 0.095, 0.07, 24), M.brass, [0, -0.215, 0]);
add(hammer, 'hammer_collar_ring', new THREE.TorusGeometry(0.092, 0.008, 8, 32), M.steelDk, [0, -0.25, 0], [Math.PI/2, 0, 0]);
add(hammer, 'hammer_handle', new THREE.CylinderGeometry(0.048, 0.052, 0.8, 24), M.leather, [0, -0.66, 0]);
for (let i = 0; i < 12; i++) add(hammer, `handle_wrap_${i+1}`, new THREE.TorusGeometry(0.053, 0.007, 8, 32), M.leather, [0, -0.32 - i*0.058, 0], [Math.PI/2 + 0.18*(i%2 ? 1 : -1), 0, 0]);
add(hammer, 'hammer_pommel', new THREE.CylinderGeometry(0.068, 0.058, 0.09, 24), M.brass, [0, -1.1, 0]);
add(hammer, 'hammer_pommel_cap', new THREE.SphereGeometry(0.058, 24, 12, 0, Math.PI*2, Math.PI/2, Math.PI/2), M.brass, [0, -1.145, 0]);
add(hammer, 'hammer_strap', new THREE.TorusGeometry(0.075, 0.011, 8, 40), M.leather, [0, -1.25, 0], [0, 0, 0]);
// Hologram star map: disc + rising rings
const holo = new THREE.Group(); holo.name = 'hologram'; holo.position.y = 1.0; model.add(holo);
const holoDisc = add(holo, 'holo_disc', new THREE.CircleGeometry(1.35, 64), M.holo, [0, 0.02, 0], [-Math.PI/2, 0, 0]);
const holoRings = [0.5, 0.85, 1.2, 1.5].map((r, i) => add(holo, `holo_ring_${i+1}`, new THREE.TorusGeometry(r, 0.006, 6, 96), M.holoLine, [0, 0.05 + i*0.12, 0], [Math.PI/2, 0, 0]));
const holoBeam = add(holo, 'holo_beam', new THREE.CylinderGeometry(0.06, 0.25, 1.1, 24, 1, true), M.holo, [0, 0.55, 0]);
[holoDisc, holoBeam, ...holoRings].forEach(m => m.castShadow = m.receiveShadow = false);
const coreLight = new THREE.PointLight(0x4a9aff, 50, 9, 2); coreLight.position.set(0, 2.0, 0); model.add(coreLight);

// Satellites
const stations = agents.map(a => {
  const ang = THREE.MathUtils.degToRad(a.angle), R = 2.05;
  const grp = new THREE.Group(); grp.name = `${a.key}_station`;
  grp.position.set(Math.cos(ang)*R, 0, Math.sin(ang)*R);
  const m = sigil(`${a.key}_bolt`, a.hex, a.em);
  const chan = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.012, R - 1.25), M.brass); chan.name = `${a.key}_channel`;
  chan.position.set(Math.cos(ang)*(R+1.25)/2, 0.227, Math.sin(ang)*(R+1.25)/2); chan.rotation.y = -ang + Math.PI/2; model.add(chan);
  add(grp, `${a.key}_plinth_step`, new THREE.CylinderGeometry(0.44, 0.5, 0.05, 48), M.slate, [0, 0.245, 0]);
  add(grp, `${a.key}_plinth`, new THREE.CylinderGeometry(0.34, 0.4, 0.08, 48), M.stone, [0, 0.31, 0]);
  add(grp, `${a.key}_plinth_ring`, new THREE.TorusGeometry(0.3, 0.015, 10, 64), M.brass, [0, 0.355, 0], [Math.PI/2, 0, 0]);
  const glowRing = add(grp, `${a.key}_glow_ring`, new THREE.TorusGeometry(0.24, 0.01, 8, 48), mat(`${a.key}_glow`, a.hex, { emissive: a.hex, emissiveIntensity: 2, roughness: 1, metalness: 0 }), [0, 0.36, 0], [Math.PI/2, 0, 0]);
  const gemGrp = new THREE.Group(); gemGrp.position.y = 0.9; grp.add(gemGrp);
  const sig = new THREE.Group(); sig.name = `${a.key}_sigil`; gemGrp.add(sig);
  const coreM = mat(`${a.key}_bolt_core`, 0xffffff, { emissive: 0xffffff, emissiveIntensity: 2.2, roughness: 0.4 });
  buildSigil(sig, a.key, m, coreM);
  const gm = add(gemGrp, `${a.key}_pick`, new THREE.CylinderGeometry(0.26, 0.26, 1.2, 8), new THREE.MeshBasicMaterial({ visible: false })); gm.castShadow = gm.receiveShadow = false;
  const halo = add(gemGrp, `${a.key}_halo`, new THREE.TorusGeometry(0.4, 0.008, 8, 64), M.brass, [0,0,0], [Math.PI/2 + 0.5, 0.3, 0]);
  const light = new THREE.PointLight(a.hex, 8, 4, 2); light.position.y = 0.95; grp.add(light);
  const from = new THREE.Vector3(Math.cos(ang)*R, 0.9, Math.sin(ang)*R), to = new THREE.Vector3(0, 1.9, 0);
  const len = from.distanceTo(to);
  const beamMat = mat(`${a.key}_beam`, a.hex, { emissive: a.hex, emissiveIntensity: 2.5, transparent: true, opacity: 0.12, roughness: 1, metalness: 0 });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.05, len, 8), beamMat); beam.name = `${a.key}_beam`;
  beam.position.copy(from).lerp(to, 0.5);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), to.clone().sub(from).normalize());
  beam.castShadow = false; model.add(beam);
  model.add(grp);
  return { a, grp, gemGrp, gm, sig, coreM, m, halo, glowRing, light, beam, beamMat, ang, phase: random()*6.28, hot: 0 };
});
// Effects belong to the same root as the solids so transforms and disposal stay coherent.
const effects = new THREE.Group(); effects.name = 'astral_effects'; model.add(effects);
model.traverse(o => { if (o.isMesh && /wrap|stud|groove|ring_\d_star|halo|glow|beam|channel|holo|rune|bolt/.test(o.name)) o.castShadow = false; });
const SEG = 32;
function mkBolt(color, n = SEG, taper = false) {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
  geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
  if (taper) {
    const colors = new Float32Array(n * 6);
    for (let i = 0; i < n; i++) for (let j = 0; j < 6; j++) colors[i * 6 + j] = 1 - (i + (j > 2 ? 1 : 0)) / n * .85;
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  const line = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({color, vertexColors: taper, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false}));
  line.frustumCulled = false; effects.add(line); return line;
}
const A = new THREE.Vector3(), B = new THREE.Vector3(), P = new THREE.Vector3(), O = new THREE.Vector3();
const D = new THREE.Vector3(), U = new THREE.Vector3(), V = new THREE.Vector3();
const path = Array.from({length: SEG + 1}, () => new THREE.Vector3());
// The recursion and scratch vectors are created once, including for non-power-of-two branches.
function subdivide(i, j, amp) {
  if (j - i < 2) return;
  const mid = (i + j) >> 1;
  path[mid].lerpVectors(path[i], path[j], (mid - i) / (j - i) + (random() - .5) * .15);
  path[mid].addScaledVector(U, (random() * 2 - 1) * amp).addScaledVector(V, (random() * 2 - 1) * amp);
  subdivide(i, mid, amp * .55); subdivide(mid, j, amp * .55);
}
function buildPath(a, b, amp, n) {
  path[0].copy(a); path[n].copy(b);
  D.subVectors(b, a).normalize(); U.set(0, 1, 0); if (Math.abs(D.y) > .9) U.set(1, 0, 0);
  U.cross(D).normalize(); V.crossVectors(D, U); subdivide(0, n, amp);
}
function writePath(line, n) {
  const positions = line.geometry.attributes.position;
  for (let i = 0; i < n; i++) {
    const a = path[i], b = path[i + 1], k = i * 6;
    positions.array[k] = a.x; positions.array[k + 1] = a.y; positions.array[k + 2] = a.z;
    positions.array[k + 3] = b.x; positions.array[k + 4] = b.y; positions.array[k + 5] = b.z;
  }
  positions.needsUpdate = true;
}
function localPosition(object, out) { object.getWorldPosition(out); return model.worldToLocal(out); }
function edgePoint(s, out) {
  const edge = BOLT_EDGE[Math.floor(random() * BOLT_EDGE.length)];
  out.set(edge[0], edge[1], edge[2]); s.sig.localToWorld(out); model.worldToLocal(out);
}
for (const s of stations) {
  s.bolt = mkBolt(s.a.bolt); s.bolt.name = `${s.a.key}_lightning_main`;
  s.sleeve = mkBolt(s.a.hex); s.boltCore = mkBolt(0xffffff);
  s.branches = Array.from({length: 3}, () => mkBolt(s.a.bolt, 12, true));
  s.branchOpacity = new Float32Array(3);
  s.inner = Array.from({length: 5}, () => mkBolt(0xffffff, 8));
  s.crawl = Array.from({length: 3}, () => mkBolt(s.a.bolt, 10));
  s.arcOpacity = new Float32Array(8);
  s.main = Array.from({length: SEG + 1}, () => new THREE.Vector3());
  s.sparkSeed = new Float32Array(120);
  for (let i = 0; i < 40; i++) { s.sparkSeed[i*3] = random()*Math.PI*2; s.sparkSeed[i*3+1] = random()*2-1; s.sparkSeed[i*3+2] = .5+random()*1.5; }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(120), 3));
  geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
  s.sparks = new THREE.Points(geometry, new THREE.PointsMaterial({color:s.a.bolt, size:.02, transparent:true, opacity:.9, blending:THREE.AdditiveBlending, depthWrite:false}));
  s.sparks.frustumCulled = false; effects.add(s.sparks);
  s.nextOrb = 0; s.nextJit = 0; s.strike = 0; s.nextStrike = .35+random()*1.4; s.restrikes = 0;
}
const starN = 160, starPos = new Float32Array(starN*3);
for (let i=0;i<starN;i++) { const a=random()*Math.PI*2,r=1.3+random()*1.6; starPos[i*3]=Math.cos(a)*r;starPos[i*3+1]=.235;starPos[i*3+2]=Math.sin(a)*r; }
const starGeo = new THREE.BufferGeometry(); starGeo.setAttribute('position',new THREE.BufferAttribute(starPos,3));
const stars = new THREE.Points(starGeo,new THREE.PointsMaterial({color:0x9fd0ff,size:.03,transparent:true,opacity:.9,blending:THREE.AdditiveBlending,depthWrite:false})); effects.add(stars);
const linePos = [];
for(let i=0;i<starN;i++) { let best=-1,bd=.55; for(let j=i+1;j<starN;j++) {const d=Math.hypot(starPos[i*3]-starPos[j*3],starPos[i*3+2]-starPos[j*3+2]);if(d<bd){bd=d;best=j;}} if(best>=0)linePos.push(starPos[i*3],.235,starPos[i*3+2],starPos[best*3],.235,starPos[best*3+2]); }
const lineGeo = new THREE.BufferGeometry(); lineGeo.setAttribute('position',new THREE.Float32BufferAttribute(linePos,3));
const constel = new THREE.LineSegments(lineGeo,new THREE.LineBasicMaterial({color:0x4a8adf,transparent:true,opacity:.3,blending:THREE.AdditiveBlending,depthWrite:false}));effects.add(constel);
const dustN=260,dustPos=new Float32Array(dustN*3),dustSeed=new Float32Array(dustN);
for(let i=0;i<dustN;i++){const a=random()*Math.PI*2,r=.6+random()*2.6;dustPos[i*3]=Math.cos(a)*r;dustPos[i*3+1]=.3+random()*3.4;dustPos[i*3+2]=Math.sin(a)*r;dustSeed[i]=random()*Math.PI*2;}
const dustGeo=new THREE.BufferGeometry();dustGeo.setAttribute('position',new THREE.BufferAttribute(dustPos,3));dustGeo.attributes.position.setUsage(THREE.DynamicDrawUsage);
const dust=new THREE.Points(dustGeo,new THREE.PointsMaterial({color:0x8fc4ff,size:.03,transparent:true,opacity:.7,blending:THREE.AdditiveBlending,depthWrite:false}));effects.add(dust);
const hammerAnchor=new THREE.Object3D();hammer.add(hammerAnchor);
const hammerPickables=hammer.children.filter(o=>o.isMesh);
for(const mesh of hammerPickables)mesh.userData.agentKey='core';
for(const s of stations)s.gm.userData.agentKey=s.a.key;
const pickables=hammerPickables.concat(stations.map(s=>s.gm));
const coreOccluders=model.children.filter(o=>o.isMesh&&/pedestal|dais_base|dais_step/.test(o.name)).concat(rings.map(g=>g.children[0]));
const occluders=coreOccluders.concat(hammerPickables);
let time=0,pulseValue=0,flashOpacity=0,disposed=false,lastHover=null;
const pointerSmoothed=new THREE.Vector2(),idlePointer=new THREE.Vector2();
const defaultState={pointer:idlePointer,hover:null,animated:true};
function update(dt,state=defaultState){
 if(disposed)return;
 const pointer=state.pointer||idlePointer,hover=state.hover||null;
 lastHover=hover;
 if(state.animated===false)return;
 dt=Number.isFinite(dt)?Math.max(0,dt):0;time+=dt;
 const t=time,k=1-Math.exp(-6*dt),beat=.5+.5*Math.sin(t*2);
 pointerSmoothed.lerp(pointer.x < -5?idlePointer:pointer,k);pulseValue*=Math.exp(-4*dt);
 core.position.y=2+Math.sin(t*1.2)*.07;core.rotation.z=pointerSmoothed.x*.14;core.rotation.x=-pointerSmoothed.y*.1;
 hammer.rotation.y=.6+t*.25;hammer.position.y=Math.sin(t*1.9)*.04;
 rings[0].rotation.z=.3+.9*t;rings[1].rotation.x=Math.PI/2-.3+.7*t;rings[2].rotation.y=.6+1.2*t;rings[3].rotation.z=-.6*t;
 armillary.rotation.y=t*.25;
 runeMat.emissiveIntensity=1.2+beat*1.2+pulseValue*4;
 M.steel.emissive.setHex(0x0f2a55);M.steel.emissiveIntensity=.1+beat*.15+pulseValue*1.2;
 coreLight.intensity=40+beat*25+pulseValue*160+(hover==='core'?30:0);
 coreLight.color.setHSL(.6-pulseValue*.05,.9,.55+pulseValue*.3);
 holo.rotation.y=-t*.25;M.holo.opacity=.16+beat*.1;M.holoLine.opacity=.45+beat*.3;
 for(let i=0;i<holoRings.length;i++){const r=holoRings[i];r.position.y=.05+((i*.12+t*.15)%.5);r.scale.setScalar(1+Math.sin(t*1.5+i)*.04);}
 constel.material.opacity=.18+beat*.15;stars.material.opacity=.5+beat*.3;
 for(let i=0;i<dustN;i++){dustPos[i*3+1]=.3+((dustPos[i*3+1]-.3+dt*(.06+.05*Math.sin(dustSeed[i])))%3.6);dustPos[i*3]+=Math.sin(t*.6+dustSeed[i])*dt*.05;}
 dustGeo.attributes.position.needsUpdate=true;dust.material.opacity=.45+beat*.3;
 flashOpacity=pulseValue*.35;
 // Update all transforms before sampling anchors; effects use root-local coordinates.
 for(let i=0;i<stations.length;i++){
  const s=stations[i];s.hot+=((hover===s.a.key?1:0)-s.hot)*k;
  s.gemGrp.position.y=.9+Math.sin(t*1.7+s.phase)*.07+s.hot*.15;
  s.gemGrp.rotation.y=t*(.9+i*.1)+s.hot*.3;s.gemGrp.rotation.z=Math.sin(t*1.1+s.phase)*.12;
  s.halo.rotation.z+=(1.2+s.hot*3)*dt;
  s.sig.scale.setScalar(.95+s.hot*.3+pulseValue*.2+s.strike*.08);
  s.sig.rotation.set(Math.sin(t*.9+s.phase)*.15,0,Math.sin(t*1.3+s.phase)*.08);
 }
 model.updateWorldMatrix(true,true);
 for(let i=0;i<stations.length;i++){
  const s=stations[i],flicker=.5+.5*Math.sin(t*3+s.phase*2);
  s.strike*=Math.exp(-dt*(s.hot>.3?3:7));
  if(t>=s.nextStrike){s.nextStrike=t+(.35+random()*1.4)/(1+s.hot*1.5);s.strike=1;s.nextJit=0;s.restrikes=1+Math.floor(random()*3);}
  if(s.strike<.35&&s.restrikes>0&&random()<1-Math.exp(-dt*6)){s.strike=.85;s.restrikes--;s.nextJit=0;}
  s.m.emissiveIntensity=.9+flicker*.4+s.hot*1.2+pulseValue+s.strike*1.8;
  s.coreM.emissiveIntensity=2+s.strike*3+s.hot*1.5+(random()*2-1)*.6;
  const orbGlow=.55+s.hot*.4+s.strike*.5+pulseValue*.4;
  if(t>=s.nextOrb){
   s.nextOrb=t+.04+random()*.04;
   for(let j=0;j<5;j++){edgePoint(s,A);edgePoint(s,B);buildPath(A,B,.08,8);writePath(s.inner[j],8);s.arcOpacity[j]=(j<2||random()>.5)?(.5+random()*.5):0;}
   for(let j=0;j<3;j++){
    if(j<2){A.set(j===0?.14:-.16,j===0?.55:-.55,0);s.sig.localToWorld(A);model.worldToLocal(A);}else edgePoint(s,A);
    B.set(A.x+(random()-.5)*.5,A.y+(j===1?-.1:.1)+(random()-.5)*.4,A.z+(random()-.5)*.5);
    buildPath(A,B,.12,10);writePath(s.crawl[j],10);s.arcOpacity[j+5]=random()>.3?.6+random()*.4:0;
   }
  }
  for(let j=0;j<5;j++)s.inner[j].material.opacity=orbGlow*s.arcOpacity[j];
  for(let j=0;j<3;j++)s.crawl[j].material.opacity=orbGlow*s.arcOpacity[j+5];
  localPosition(s.sig,P);
  const sp=s.sparks.geometry.attributes.position;
  for(let j=0;j<40;j++){const a0=s.sparkSeed[j*3],a=a0+t*s.sparkSeed[j*3+2]*(1+s.hot),r=.43+.04*Math.sin(t*1.3+a0);sp.array[j*3]=P.x+Math.cos(a)*r;sp.array[j*3+1]=P.y+Math.sin(a)*r*s.sparkSeed[j*3+1]*.6+Math.sin(t*2+a0)*.03;sp.array[j*3+2]=P.z+Math.sin(a)*r;}
  sp.needsUpdate=true;s.sparks.material.opacity=.5+s.hot*.5+s.strike*.4;s.sparks.material.size=.02+s.hot*.015+s.strike*.01;
  s.glowRing.material.emissiveIntensity=1.5+flicker+s.hot*3;
  s.beamMat.opacity=.06+flicker*.06+s.hot*.2+pulseValue*.2;s.beam.scale.x=s.beam.scale.z=1+s.hot*2+pulseValue*1.5;
  if(t>=s.nextJit&&(s.strike>.15||s.hot>.3||pulseValue>.2)){
   s.nextJit=t+.04+random()*.05;localPosition(s.gemGrp,A);localPosition(hammerAnchor,B);
   const amp=.45+s.hot*.35+pulseValue*.5;
   buildPath(A,B,amp,SEG);for(let j=0;j<=SEG;j++)s.main[j].copy(path[j]);
   writePath(s.bolt,SEG);writePath(s.sleeve,SEG);writePath(s.boltCore,SEG);
   for(let j=0;j<3;j++){
    const start=4+Math.floor(random()*(SEG-10));P.copy(s.main[start]);
    O.copy(s.main[Math.min(SEG,start+6)]).sub(P).multiplyScalar(.6+random()*.5);
    O.x+=(random()-.5)*.7+Math.cos(s.ang)*.2;O.y-=random()*.6;O.z+=(random()-.5)*.7+Math.sin(s.ang)*.2;O.add(P);
    buildPath(P,O,amp*.5,12);writePath(s.branches[j],12);s.branchOpacity[j]=random()>.3?.25+random()*.35:0;
   }
  }
  const glow=Math.max(s.strike,s.hot*.7,pulseValue*.9),jit=.85+random()*.3;
  s.bolt.material.opacity=glow*jit;s.sleeve.material.opacity=glow*.35*jit;s.boltCore.material.opacity=glow*glow*.9*jit;
  for(let j=0;j<3;j++)s.branches[j].material.opacity=s.branchOpacity[j]*glow*jit;
  s.light.intensity=7+flicker*4+s.hot*18+pulseValue*16+s.strike*30;
  flashOpacity=Math.max(flashOpacity,s.strike*.18);
 }
}
function pulse(key=lastHover){
 if(disposed)return;
 pulseValue=1;flashOpacity=.35;
 let target=null;
 for(let i=0;i<stations.length;i++){const s=stations[i];s.strike=1;s.nextJit=0;s.restrikes=3;s.nextStrike=time+.35+random()*1.4;if(s.a.key===key)target=s;}
 if(!target)target=stations[Math.floor(random()*stations.length)];target.hot=Math.max(target.hot,1.2);
}
// Populate visible live arcs even when the caller chooses a static/reduced-motion scene.
update(0);
const geometries=new Set(),materials=new Set();
model.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(Array.isArray(o.material)){for(const m of o.material)materials.add(m);}else if(o.material)materials.add(o.material);});
return {root:model,core,coreCrystal:hammerPickables[0],hammer,armillary,stations,rings,M,coreLight,dust,stars,constel,effects,pickables,occluders,coreOccluders,update,pulse,
 get time(){return time;},get pulseValue(){return pulseValue;},get flashOpacity(){return flashOpacity;},get flash(){return flashOpacity;},
 dispose(){if(disposed)return;disposed=true;for(const g of geometries)g.dispose();for(const m of materials)m.dispose();model.removeFromParent();model.clear();}
};
}
