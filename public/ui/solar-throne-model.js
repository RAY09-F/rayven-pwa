// Production model port of the Solar Throne design handoff (Odin's council).
export const SOLAR_AGENT_IDS = { core: 'odin', ruby: 'volstagg', topaz: 'heimdall', emerald: 'fandral', sapphire: 'hogun', amethyst: 'frigga' };
export function buildSolarThrone(THREE, { random = Math.random } = {}) {
const mat = (name, color, o={}) => Object.assign(new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.2, ...o }), { name });
const glow = (name, color, opacity) => Object.assign(new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }), { name });
const M = {
  marble:   mat('black_marble', 0x0e1014, { roughness: 0.5, metalness: 0.08 }),
  marbleDk: mat('black_marble_dark', 0x070809, { roughness: 0.55, metalness: 0.05 }),
  gold:     mat('gold', 0xe0b050, { roughness: 0.22, metalness: 0.9, emissive: 0x3a2200, emissiveIntensity: 0.3 }),
  goldDk:   mat('gold_dark', 0x9a7430, { roughness: 0.35, metalness: 0.85 }),
  goldLit:  mat('gold_light', 0xffc860, { emissive: 0xff9a20, emissiveIntensity: 1.2, roughness: 0.4, metalness: 0.2 }),
  goldGlow: mat('gold_inlay_glow', 0xffc470, { emissive: 0xff9a20, emissiveIntensity: 1.6, roughness: 0.35, metalness: 0.4 }),
  eyeGold:  mat('eye_gold', 0xe8bc62, { roughness: 0.16, metalness: 0.92, emissive: 0x3a2200, emissiveIntensity: 0.25 }),
  pupil:    mat('pupil', 0x05060a, { roughness: 0.35, metalness: 0 }),
  void:     mat('void', 0x02030a, { roughness: 0.9, metalness: 0 }),
  cornea:   Object.assign(new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0, metalness: 0, transmission: 1, thickness: 0.12, ior: 1.42, clearcoat: 1, transparent: true, opacity: 0.35 }), { name: 'cornea' }),
  sun:      glow('sun_glow', 0xffc870, 0.55),
  halo:     glow('sun_halo', 0xffc870, 0.14),
  beam:     glow('light_beam', 0xff9a30, 0.05),
};
const agents = [
  { key: 'ruby',     name: 'VOLSTAGG', role: 'SUPPLY · GROWTH · PEOPLE',       hex: 0xff3a3a, em: 0xff0a0a, css: '#ff6a6a', angle: 90 },
  { key: 'topaz',    name: 'HEIMDALL', role: 'GOLD · GEO · MOMENTUM · ALERTS', hex: 0xffc21a, em: 0xff8c00, css: '#ffd84a', angle: 18 },
  { key: 'emerald',  name: 'FANDRAL',  role: 'BITCOIN · RISK · EXECUTION',     hex: 0x2aff8a, em: 0x00c850, css: '#4dffa3', angle: 306 },
  { key: 'sapphire', name: 'HOGUN',    role: 'NASDAQ · MACRO · FLOW',          hex: 0x3a8aff, em: 0x0a4aff, css: '#6aa8ff', angle: 234 },
  { key: 'amethyst', name: 'FRIGGA',   role: 'ETHEREUM · MOMENTUM · TRENDS',   hex: 0xa040ff, em: 0x5a00ff, css: '#c088ff', angle: 162 },
];

const add = (parent, name, geo, m, pos=[0,0,0], rot=[0,0,0]) => {
  const mesh = new THREE.Mesh(geo, m); mesh.name = name;
  mesh.position.set(...pos); mesh.rotation.set(...rot);
  mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh;
};
const flat = mesh => { mesh.castShadow = mesh.receiveShadow = false; return mesh; };
// Thin gold and glass keep receiving shadows from the throne; they just stop casting.
const noCast = mesh => { mesh.castShadow = false; return mesh; };
// Faceted crystal: a spire of stacked offset rings closed by an apex and a tip.
const crystal = (r, hUp, hDown, n=6) => {
  const ring = (rad, y, off) => Array.from({ length: n }, (_, i) => { const a = (i + off) / n * Math.PI * 2; return [Math.cos(a)*rad, y, Math.sin(a)*rad*0.9]; });
  const R = [ring(r*0.55, hUp*0.5, 0.5), ring(r, 0, 0), ring(r*0.6, -hDown*0.45, 0.5), [[0, -hDown, 0]]];
  const P = [], tri = (a, b, c) => P.push(...a, ...b, ...c), apex = [0, hUp, 0];
  for (let i = 0; i < n; i++) tri(apex, R[0][i], R[0][(i+1)%n]);
  for (let k = 0; k < R.length - 2; k++) for (let i = 0; i < n; i++) { const a = R[k][i], b = R[k][(i+1)%n], c = R[k+1][i], d = R[k+1][(i+1)%n]; tri(a, c, d); tri(a, d, b); }
  const last = R[R.length-2], tip = R[R.length-1][0];
  for (let i = 0; i < n; i++) tri(last[i], tip, last[(i+1)%n]);
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.computeVertexNormals(); return g;
};
// The eight rim gems and the fourteen orbit shards are each one shared geometry.
const rimGemGeo = crystal(0.05, 0.1, 0.1, 6), shardGeo = crystal(0.045, 0.13, 0.09, 5);

const model = new THREE.Group(); model.name = 'solar_throne';
// Floor: polished black marble with glowing gold inlays and radial spokes
add(model, 'floor_disc', new THREE.CylinderGeometry(4.2, 4.3, 0.14, 96), M.marbleDk, [0, 0.07, 0]);
add(model, 'floor_step', new THREE.CylinderGeometry(3.5, 3.6, 0.08, 96), M.marble, [0, 0.18, 0]);
[4.0, 3.75, 3.15, 2.6, 2.0].forEach((r, i) => noCast(add(model, `floor_inlay_${i+1}`, new THREE.TorusGeometry(r, i%2 ? 0.012 : 0.022, 8, 220), M.goldGlow, [0, r > 3.55 ? 0.142 : 0.222, 0], [Math.PI/2, 0, 0])));
for (let i = 0; i < 24; i++) { const a = i/24*Math.PI*2; add(model, `floor_spoke_${i+1}`, new THREE.BoxGeometry(0.02, 0.006, 0.6), M.goldDk, [Math.cos(a)*3.88, 0.142, Math.sin(a)*3.88], [0, -a + Math.PI/2, 0]); }
// The gold light the council sits on
const councilRing = flat(add(model, 'council_ring', new THREE.RingGeometry(2.78, 3.02, 128), glow('council_ring', 0xffbe58, 0.16), [0, 0.229, 0], [-Math.PI/2, 0, 0]));
const innerGlowDisc = flat(add(model, 'council_glow_disc', new THREE.RingGeometry(0.9, 2.05, 96), glow('council_glow_disc', 0xffa030, 0.07), [0, 0.228, 0], [-Math.PI/2, 0, 0]));
// Pedestal: wide stacked marble drums with gold bands and rune panels
add(model, 'pedestal_drum_1', new THREE.CylinderGeometry(1.55, 1.62, 0.22, 96), M.marble, [0, 0.33, 0]);
add(model, 'pedestal_band_1', new THREE.TorusGeometry(1.57, 0.025, 10, 128), M.gold, [0, 0.45, 0], [Math.PI/2, 0, 0]);
add(model, 'pedestal_drum_2', new THREE.CylinderGeometry(1.32, 1.38, 0.26, 96), M.marbleDk, [0, 0.57, 0]);
add(model, 'pedestal_band_2', new THREE.TorusGeometry(1.34, 0.025, 10, 128), M.gold, [0, 0.71, 0], [Math.PI/2, 0, 0]);
add(model, 'pedestal_drum_3', new THREE.CylinderGeometry(1.1, 1.16, 0.22, 96), M.marble, [0, 0.82, 0]);
add(model, 'pedestal_cap', new THREE.CylinderGeometry(1.0, 1.1, 0.06, 96), M.gold, [0, 0.96, 0]);
for (let i = 0; i < 16; i++) { const a = i/16*Math.PI*2; add(model, `pedestal_panel_${i+1}`, new THREE.BoxGeometry(0.28, 0.16, 0.03), M.goldDk, [Math.cos(a)*1.36, 0.57, Math.sin(a)*1.36], [0, -a + Math.PI/2, 0]); }
// Solar disc: nested gold layers funnelling into a dark aperture (billboards toward the viewer)
const core = new THREE.Group(); core.name = 'core'; core.position.y = 2.15; model.add(core);
const disc = new THREE.Group(); disc.name = 'solar_disc'; core.add(disc);
add(disc, 'disc_rim', new THREE.TorusGeometry(1.24, 0.075, 20, 160), M.gold);
add(disc, 'disc_rim_outer', new THREE.TorusGeometry(1.34, 0.03, 12, 160), M.goldDk);
add(disc, 'disc_rim_bevel', new THREE.TorusGeometry(1.16, 0.045, 14, 160), M.goldLit);
// Concentric stepped layers: each ring smaller and deeper, so the face reads as a funnel
const layers = [];
for (let i = 0; i < 7; i++) {
  const r = 1.1 - i*0.115, z = -0.03 - i*0.055;
  const ring = add(disc, `disc_layer_${i+1}`, new THREE.TorusGeometry(r, 0.05 - i*0.004, 12, 128), i%2 ? M.goldDk : M.gold, [0, 0, z]);
  const trim = add(disc, `disc_layer_trim_${i+1}`, new THREE.TorusGeometry(r, 0.012, 8, 128), M.goldLit, [0, 0, z + 0.035]);
  const teeth = new THREE.Group(); teeth.name = `disc_layer_teeth_${i+1}`; teeth.position.z = z; disc.add(teeth);
  const n = 18 - i, toothGeo = new THREE.BoxGeometry(0.055, 0.11 - i*0.008, 0.03);
  for (let k = 0; k < n; k++) { const a = k/n*Math.PI*2; add(teeth, `disc_layer_${i+1}_tooth_${k+1}`, toothGeo, i%2 ? M.gold : M.goldDk, [Math.cos(a)*r, Math.sin(a)*r, 0.03], [0, 0, a]); }
  layers.push({ ring, trim, teeth, dir: i%2 ? 1 : -1, r, base: z });
}
const studGeo = new THREE.SphereGeometry(0.028, 10, 8);
for (let i = 0; i < 36; i++) { const a = i/36*Math.PI*2; add(disc, `disc_stud_${i+1}`, studGeo, M.goldLit, [Math.cos(a)*1.24, Math.sin(a)*1.24, 0.085]); }
for (let i = 0; i < 8; i++) { const a = i/8*Math.PI*2 + Math.PI/8; add(disc, `disc_gem_${i+1}`, rimGemGeo, M.goldLit, [Math.cos(a)*1.24, Math.sin(a)*1.24, 0.12], [0, 0, a - Math.PI/2]); }
// Aperture: ten spiral blades that breathe open and shut
const iris = new THREE.Group(); iris.name = 'iris'; iris.position.z = -0.42; disc.add(iris);
const bladeGeo = new THREE.TorusGeometry(0.42, 0.085, 12, 48, Math.PI*0.85), bladeEdgeGeo = new THREE.TorusGeometry(0.42, 0.014, 8, 48, Math.PI*0.85);
const blades = [], bladeEdges = [], bladeCos = new Float32Array(10), bladeSin = new Float32Array(10);
for (let i = 0; i < 10; i++) {
  const a = i/10*Math.PI*2; bladeCos[i] = Math.cos(a); bladeSin[i] = Math.sin(a);
  const b = add(iris, `iris_blade_${i+1}`, bladeGeo, M.gold, [bladeCos[i]*0.24, bladeSin[i]*0.24, 0], [0, 0, a + Math.PI*0.5]);
  b.scale.set(1, 1, 0.5); blades.push(b);
  bladeEdges.push(add(iris, `iris_blade_edge_${i+1}`, bladeEdgeGeo, M.goldLit, [bladeCos[i]*0.24, bladeSin[i]*0.24, 0.05], [0, 0, a + Math.PI*0.5]));
}
// Event horizon: dark core with bright accretion rings and a sun hidden behind it
const hole = add(disc, 'event_horizon', new THREE.SphereGeometry(0.26, 40, 28), M.void, [0, 0, -0.5]);
const accretion = add(disc, 'accretion_ring', new THREE.TorusGeometry(0.32, 0.012, 10, 96), M.goldLit, [0, 0, -0.48]);
const accretion2 = add(disc, 'accretion_ring_2', new THREE.TorusGeometry(0.42, 0.006, 8, 96), M.goldLit, [0, 0, -0.44], [0.5, 0.2, 0]);
const sun = flat(add(disc, 'sun_core', new THREE.CircleGeometry(0.5, 48), M.sun, [0, 0, -0.56]));
const sunBack = flat(add(disc, 'sun_halo', new THREE.CircleGeometry(1.05, 64), M.halo, [0, 0, -0.62]));
// Orbiting gold shards
const shards = Array.from({ length: 14 }, (_, i) => {
  const g = new THREE.Group(); g.name = `orbit_${i+1}`; core.add(g);
  const m = noCast(add(g, `orbit_shard_${i+1}`, shardGeo, M.goldLit, [1.45 + (i%3)*0.14, 0, 0], [0.4*i, 0.2*i, 0]));
  g.rotation.set((i%5)*0.25 - 0.5, i*0.9, (i%3)*0.2);
  return { g, m, spd: 0.25 + (i%4)*0.12, phase: i*0.7, radius: 1.45 + (i%3)*0.14 };
});
// Flanking pylons: angular black-marble slabs with gold edges, leaning inward
const pylons = [-1, 1].map((sgn, i) => {
  const g = new THREE.Group(); g.name = `pylon_${i+1}`; g.position.set(sgn*1.45, 0.99, -0.05); g.rotation.z = -sgn*0.06; model.add(g);
  add(g, `pylon_${i+1}_base`, new THREE.BoxGeometry(0.52, 0.22, 0.62), M.marble, [0, 0.11, 0]);
  add(g, `pylon_${i+1}_base_band`, new THREE.BoxGeometry(0.56, 0.04, 0.66), M.gold, [0, 0.24, 0]);
  add(g, `pylon_${i+1}_shaft`, new THREE.BoxGeometry(0.34, 1.5, 0.5), M.marbleDk, [0, 1.0, 0]);
  add(g, `pylon_${i+1}_shaft_front`, new THREE.BoxGeometry(0.06, 1.45, 0.04), M.gold, [-sgn*0.15, 1.0, 0.26]);
  add(g, `pylon_${i+1}_shaft_back`, new THREE.BoxGeometry(0.06, 1.45, 0.04), M.goldDk, [-sgn*0.15, 1.0, -0.26]);
  add(g, `pylon_${i+1}_blade`, new THREE.CylinderGeometry(0.02, 0.16, 1.1, 4), M.marbleDk, [sgn*0.02, 2.25, 0], [0, Math.PI/4, -sgn*0.16]);
  add(g, `pylon_${i+1}_blade_edge`, new THREE.CylinderGeometry(0.008, 0.05, 1.12, 4), M.gold, [sgn*0.02, 2.25, 0.06], [0, Math.PI/4, -sgn*0.16]);
  add(g, `pylon_${i+1}_collar`, new THREE.BoxGeometry(0.4, 0.06, 0.56), M.gold, [0, 1.72, 0]);
  for (let k = 0; k < 3; k++) add(g, `pylon_${i+1}_rune_${k+1}`, new THREE.BoxGeometry(0.18, 0.1, 0.02), M.goldDk, [0, 0.6 + k*0.4, 0.26]);
  return g;
});
noCast(add(core, 'light_beam', new THREE.CylinderGeometry(0.02, 0.35, 4.0, 24, 1, true), M.beam, [0, 2.6, 0]));
const coreLight = new THREE.PointLight(0xffb040, 26, 5.5, 2); coreLight.position.set(0, 2.15, 0.6); model.add(coreLight);
const backLight = new THREE.PointLight(0xff9a30, 10, 4, 2); backLight.position.set(0, 2.15, -0.8); model.add(backLight);

// Odin's eye: polished gold orb with the agent's color as the glowing domed pupil
const lashGeo = new THREE.ConeGeometry(0.012, 0.07, 4);
const buildEye = (parent, key, hex, em) => {
  const eye = new THREE.Group(); eye.name = `${key}_eye`; parent.add(eye);
  const orb = add(eye, `${key}_orb`, new THREE.SphereGeometry(0.26, 48, 34), M.eyeGold);
  add(eye, `${key}_orb_equator`, new THREE.TorusGeometry(0.262, 0.008, 8, 96), M.goldDk);
  const irisMat = Object.assign(new THREE.MeshStandardMaterial({ color: hex, emissive: em, emissiveIntensity: 2.4, roughness: 0.15, metalness: 0.1 }), { name: `${key}_pupil_glow` });
  const front = new THREE.Group(); front.name = `${key}_eye_front`; eye.add(front);
  add(front, `${key}_socket`, new THREE.TorusGeometry(0.13, 0.022, 12, 72), M.gold, [0, 0, 0.222]);
  add(front, `${key}_socket_inner`, new THREE.TorusGeometry(0.098, 0.012, 10, 64), M.goldLit, [0, 0, 0.238]);
  for (let i = 0; i < 20; i++) { const a = i/20*Math.PI*2; add(front, `${key}_lash_${i+1}`, lashGeo, M.goldDk, [Math.cos(a)*0.155, Math.sin(a)*0.155, 0.208], [Math.PI/2, 0, a]); }
  const pupil = add(front, `${key}_pupil`, new THREE.SphereGeometry(0.088, 28, 20, 0, Math.PI*2, 0, 1.05), irisMat, [0, 0, 0.205], [Math.PI/2, 0, 0]);
  add(front, `${key}_pupil_core`, new THREE.SphereGeometry(0.05, 20, 14), M.pupil, [0, 0, 0.245]);
  flat(add(front, `${key}_glint`, new THREE.CircleGeometry(0.022, 20), glow(`${key}_glint`, 0xffffff, 0.8), [-0.05, 0.055, 0.285]));
  const cornea = add(front, `${key}_cornea`, new THREE.SphereGeometry(0.268, 32, 20, 0, Math.PI*2, 0, 0.42), M.cornea, [0, 0, 0], [Math.PI/2, 0, 0]); cornea.castShadow = false;
  const brow = new THREE.Group(); brow.name = `${key}_brow`; eye.add(brow);
  [1, -1].forEach((sgn, i) => add(brow, `${key}_brow_${i+1}`, new THREE.TorusGeometry(0.3, 0.014, 8, 64, Math.PI*0.44), M.gold, [0, 0, 0], [0, 0, sgn > 0 ? Math.PI*0.28 : Math.PI*1.28]));
  return { eye, front, orb, pupil, irisMat };
};

// Effects share the model root so root-local coordinates, transforms and disposal stay coherent.
const effects = new THREE.Group(); effects.name = 'solar_effects'; model.add(effects);
// Stations: dark marble plinths with gold trim and Odin's eyes; gold channels to the throne
const stations = agents.map(a => {
  const ang = THREE.MathUtils.degToRad(a.angle), R = 3.05;
  const grp = new THREE.Group(); grp.name = `${a.key}_station`; grp.position.set(Math.cos(ang)*R, 0, Math.sin(ang)*R); grp.rotation.y = -ang + Math.PI/2;
  add(grp, `${a.key}_plinth_base`, new THREE.CylinderGeometry(0.46, 0.5, 0.12, 8), M.marbleDk, [0, 0.28, 0]);
  add(grp, `${a.key}_plinth`, new THREE.CylinderGeometry(0.36, 0.42, 0.34, 8), M.marble, [0, 0.51, 0]);
  add(grp, `${a.key}_plinth_band`, new THREE.TorusGeometry(0.4, 0.014, 8, 48), M.gold, [0, 0.36, 0], [Math.PI/2, 0, 0]);
  add(grp, `${a.key}_plinth_cap`, new THREE.CylinderGeometry(0.38, 0.36, 0.05, 8), M.gold, [0, 0.705, 0]);
  add(grp, `${a.key}_plaque`, new THREE.BoxGeometry(0.3, 0.14, 0.02), M.goldDk, [0, 0.52, 0.41]);
  const glowRing = add(grp, `${a.key}_glow_ring`, new THREE.TorusGeometry(0.22, 0.012, 8, 48), mat(`${a.key}_glow`, a.hex, { emissive: a.hex, emissiveIntensity: 2, roughness: 1, metalness: 0 }), [0, 0.74, 0], [Math.PI/2, 0, 0]);
  const sigilMat = glow(`${a.key}_floor_sigil`, a.hex, 0.26);
  flat(add(grp, `${a.key}_floor_sigil`, new THREE.RingGeometry(0.54, 0.78, 64), sigilMat, [0, 0.231, 0], [-Math.PI/2, 0, 0]));
  noCast(add(grp, `${a.key}_floor_ring`, new THREE.TorusGeometry(0.82, 0.014, 8, 96), M.goldGlow, [0, 0.235, 0], [Math.PI/2, 0, 0]));
  const gemGrp = new THREE.Group(); gemGrp.name = `${a.key}_eye_mount`; gemGrp.position.y = 1.32; grp.add(gemGrp);
  const eyeParts = buildEye(gemGrp, a.key, a.hex, a.em);
  const halo = add(gemGrp, `${a.key}_halo`, new THREE.TorusGeometry(0.42, 0.01, 8, 64), M.gold, [0, 0, 0], [Math.PI/2 + 0.5, 0.3, 0]);
  const light = new THREE.PointLight(a.hex, 4, 2.4, 2); light.position.y = 1.3; grp.add(light);
  const chanMat = mat(`${a.key}_channel`, 0xffd27a, { emissive: 0xffa030, emissiveIntensity: 1.2, roughness: 0.5 });
  const chan = noCast(add(model, `${a.key}_channel`, new THREE.BoxGeometry(0.06, 0.01, R - 1.62), chanMat, [Math.cos(ang)*(R + 1.62)/2, 0.226, Math.sin(ang)*(R + 1.62)/2], [0, -ang + Math.PI/2, 0]));
  const pulseMat = glow(`${a.key}_pulse`, 0xfff0c0, 0.9);
  const pulseMesh = flat(add(effects, `${a.key}_pulse`, new THREE.SphereGeometry(0.05, 10, 8), pulseMat));
  // Glowing arc connecting Odin to this agent: a curved tube, an additive sleeve and a travelling bead
  const from = new THREE.Vector3(Math.cos(ang)*R, 1.24, Math.sin(ang)*R), to = new THREE.Vector3(0, 2.15, 0);
  const midPt = from.clone().lerp(to, 0.5); midPt.y += 0.75;
  const curve = new THREE.QuadraticBezierCurve3(from, midPt, to);
  const threadMat = mat(`${a.key}_link`, a.hex, { emissive: a.hex, emissiveIntensity: 2.6, transparent: true, opacity: 0.32, roughness: 1, metalness: 0 });
  noCast(add(model, `${a.key}_link`, new THREE.TubeGeometry(curve, 56, 0.022, 8, false), threadMat));
  const glowMat = glow(`${a.key}_link_glow`, a.hex, 0.12);
  noCast(add(model, `${a.key}_link_glow`, new THREE.TubeGeometry(curve, 56, 0.075, 8, false), glowMat));
  const beadMat = glow(`${a.key}_link_bead`, 0xfff2d0, 0.9);
  const bead = flat(add(effects, `${a.key}_link_bead`, new THREE.SphereGeometry(0.045, 12, 10), beadMat));
  model.add(grp);
  return { a, grp, gemGrp, gm: eyeParts.orb, eyeParts, m: eyeParts.irisMat, halo, glowRing, light, chanMat, pulseMesh, pulseMat,
           threadMat, glowMat, sigilMat, curve, bead, beadMat, ang, R, phase: random()*6.28, hot: 0, pulseT: random(), beadT: random() };
});
// Only the large forms cast: trim, teeth, glows, threads and jewellery stay out of the shadow pass.
model.traverse(o => { if (o.isMesh && /band|inlay|spoke|halo|glow|channel|girdle|stud|edge|panel|plaque|link|gem_|trim|tooth|accretion|layer|sigil|lash|glint|cornea|brow|socket|equator|floor_ring/.test(o.name)) o.castShadow = false; });

// Infall motes spiralling into the hole, rising gold motes, and the two click shockwaves
const inN = 220, inPos = new Float32Array(inN*3), inA = new Float32Array(inN), inR = new Float32Array(inN), inSpd = new Float32Array(inN), inTilt = new Float32Array(inN);
for (let i = 0; i < inN; i++) { inA[i] = random()*6.283; inR[i] = 0.34 + random()*0.95; inSpd[i] = 0.8 + random()*1.6; inTilt[i] = (random()-0.5)*0.35; }
const inGeo = new THREE.BufferGeometry(); inGeo.setAttribute('position', new THREE.BufferAttribute(inPos, 3)); inGeo.attributes.position.setUsage(THREE.DynamicDrawUsage);
const infall = new THREE.Points(inGeo, new THREE.PointsMaterial({ color: 0xffd890, size: 0.028, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
infall.name = 'infall_motes'; infall.frustumCulled = false; effects.add(infall);
const dustN = 280, dustPos = new Float32Array(dustN*3), dustSeed = new Float32Array(dustN);
for (let i = 0; i < dustN; i++) { const a = random()*6.283, r = 0.3 + random()*2.9; dustPos.set([Math.cos(a)*r, 0.3 + random()*4.0, Math.sin(a)*r], i*3); dustSeed[i] = random()*6.283; }
const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3)); dustGeo.attributes.position.setUsage(THREE.DynamicDrawUsage);
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0xffc070, size: 0.03, transparent: true, opacity: 0.7, blending: THREE.AdditiveBlending, depthWrite: false }));
dust.name = 'gold_motes'; effects.add(dust);
const shockMat = glow('floor_shockwave', 0xffc060, 0), ringShockMat = glow('disc_shockwave', 0xffc060, 0);
const shock = flat(add(effects, 'floor_shockwave', new THREE.RingGeometry(0.9, 1.0, 96), shockMat, [0, 0.24, 0], [-Math.PI/2, 0, 0]));
const ringShock = flat(add(effects, 'disc_shockwave', new THREE.RingGeometry(1.2, 1.3, 96), ringShockMat, [0, 2.15, 0]));

const corePickables = blades.concat(sun);
for (const mesh of corePickables) mesh.userData.agentKey = 'core';
for (const s of stations) s.gm.userData.agentKey = s.a.key;
const pickables = corePickables.concat(stations.map(s => s.gm));
const occluders = model.children.filter(o => o.isMesh && /pedestal_drum|floor_disc/.test(o.name))
  .concat(disc.children.filter(o => /^disc_rim$|^disc_layer_\d$/.test(o.name)))
  .concat(pylons.flatMap(g => g.children.filter(o => /shaft$|base$|blade$/.test(o.name))));
// ODIN sits at the middle of its own disc, so nothing in the throne may hide its plate.
const coreOccluders = [];

let time = 0, pulseValue = 0, shockT = 0, irisSpin = 0, coreHotV = 0, disposed = false, lastHover = null;
const pointerSmoothed = new THREE.Vector2(), idlePointer = new THREE.Vector2();
const defaultState = { pointer: idlePointer, hover: null, animated: true, camera: null };
const _C = new THREE.Vector3(), _P = new THREE.Vector3(), _E = new THREE.Vector3(), _B = new THREE.Vector3();

function update(dt, state = defaultState) {
 if (disposed) return;
 const pointer = state.pointer || idlePointer, hover = state.hover || null, camera = state.camera || null;
 lastHover = hover;
 const live = state.animated !== false;
 let k = 0;
 if (live) {
  dt = Number.isFinite(dt) ? Math.min(Math.max(0, dt), 0.05) : 0;
  time += dt; k = 1 - Math.exp(-6*dt);
  pointerSmoothed.lerp(pointer.x < -5 ? idlePointer : pointer, k);
 }
 // The disc faces the viewer head-on even while paused, so orbiting never leaves it edge-on.
 if (camera) {
  disc.quaternion.copy(camera.quaternion);
  disc.rotateY(pointerSmoothed.x*0.16); disc.rotateX(-pointerSmoothed.y*0.12);
  ringShock.quaternion.copy(camera.quaternion);
 }
 if (!live) return;
 const t = time, beat = 0.5 + 0.5*Math.sin(t*1.4);
 pulseValue *= Math.exp(-4*dt); shockT *= Math.exp(-2.2*dt); irisSpin *= Math.exp(-1.5*dt);
 coreHotV += ((hover === 'core' ? 1 : 0) - coreHotV)*k;
 core.position.y = 2.15 + Math.sin(t)*0.03;
 // Aperture: a spin with a decaying click kick, and blades breathing outward
 iris.rotation.z = t*0.35 + irisSpin*0.5 + coreHotV*0.6;
 const open = 0.22 + beat*0.05 + coreHotV*0.14 + pulseValue*0.22;
 for (let i = 0; i < 10; i++) {
  blades[i].position.set(bladeCos[i]*open, bladeSin[i]*open, 0);
  bladeEdges[i].position.set(bladeCos[i]*open, bladeSin[i]*open, 0.05);
 }
 // Layers: counter-rotating teeth over counter-rotating trim, funnelling deeper with the beat
 for (let i = 0; i < layers.length; i++) {
  const L = layers[i], sp = (0.18 + i*0.05)*L.dir;
  L.teeth.rotation.z += sp*dt*(1 + pulseValue*3 + coreHotV);
  L.trim.rotation.z -= sp*dt*0.5;
  const d = L.base - (beat*0.012 + pulseValue*0.05)*(i + 1)*0.5;
  L.ring.position.z = d; L.trim.position.z = d + 0.035; L.teeth.position.z = d;
 }
 accretion.rotation.z += (1.4 + pulseValue*6)*dt; accretion.scale.setScalar(1 + beat*0.04 + pulseValue*0.25);
 accretion2.rotation.z -= (0.9 + pulseValue*4)*dt; accretion2.scale.setScalar(1 + Math.sin(t*1.7)*0.05 + pulseValue*0.3);
 hole.scale.setScalar(1 + beat*0.02 + coreHotV*0.06 - pulseValue*0.1);
 M.sun.opacity = 0.32 + beat*0.2 + coreHotV*0.35 + pulseValue*0.55;
 sun.scale.setScalar(1 + beat*0.06 + coreHotV*0.25 + pulseValue*0.5);
 M.halo.opacity = 0.1 + beat*0.07 + pulseValue*0.35;
 for (let i = 0; i < shards.length; i++) {
  const s = shards[i];
  s.g.rotation.y += s.spd*dt*(1 + coreHotV*0.8 + pulseValue*2);
  s.m.rotation.x += 1.2*dt;
  s.m.position.x = s.radius + Math.sin(t*1.1 + s.phase)*0.06 + pulseValue*0.35;
 }
 // Infall motes accelerate as they near the hole, then respawn out at the rim
 _C.copy(core.position);
 for (let i = 0; i < inN; i++) {
  inA[i] += dt*inSpd[i]*(0.6 + 1.1/Math.max(inR[i], 0.2))*(1 + pulseValue);
  inR[i] -= dt*(0.12 + pulseValue*0.5)*(1.2 - inR[i]*0.5);
  if (inR[i] < 0.3) { inR[i] = 0.9 + random()*0.5; inA[i] = random()*6.283; }
  _P.set(Math.cos(inA[i])*inR[i], Math.sin(inA[i])*inR[i], -0.5 + inTilt[i]*inR[i]*0.3).applyQuaternion(disc.quaternion).add(_C);
  inPos[i*3] = _P.x; inPos[i*3+1] = _P.y; inPos[i*3+2] = _P.z;
 }
 inGeo.attributes.position.needsUpdate = true;
 infall.material.opacity = 0.55 + beat*0.2 + coreHotV*0.3 + pulseValue*0.4;
 infall.material.size = 0.026 + pulseValue*0.02;
 M.goldGlow.emissiveIntensity = 1.2 + beat*0.5 + pulseValue*2.5;
 councilRing.material.opacity = 0.12 + beat*0.06 + pulseValue*0.35;
 innerGlowDisc.material.opacity = 0.05 + beat*0.03 + pulseValue*0.2;
 M.goldLit.emissiveIntensity = 1.0 + beat*0.6 + coreHotV*1.2 + pulseValue*2.5;
 M.beam.opacity = 0.03 + beat*0.03 + pulseValue*0.3;
 coreLight.intensity = 24 + beat*12 + coreHotV*25 + pulseValue*70;
 backLight.intensity = 9 + beat*5 + pulseValue*25;
 for (let i = 0; i < dustN; i++) {
  dustPos[i*3+1] += dt*(0.07 + 0.06*Math.sin(dustSeed[i]));
  dustPos[i*3] += Math.sin(t*0.6 + dustSeed[i])*dt*0.05;
  if (dustPos[i*3+1] > 4.4) dustPos[i*3+1] = 0.3;
 }
 dustGeo.attributes.position.needsUpdate = true;
 dust.material.opacity = 0.45 + beat*0.3 + pulseValue*0.4;
 const sw = 1 + (1 - shockT)*3.2; shock.scale.set(sw, sw, 1); shockMat.opacity = shockT*0.8;
 const rs = 1 + (1 - shockT)*1.6; ringShock.scale.set(rs, rs, 1); ringShockMat.opacity = shockT*0.7;

 for (let i = 0; i < stations.length; i++) {
  const s = stations[i];
  s.hot += ((hover === s.a.key ? 1 : 0) - s.hot)*k;
  s.gemGrp.position.y = 1.32 + Math.sin(t*1.7 + s.phase)*0.05 + s.hot*0.14;
  // Eyes watch the viewer: the camera in the mount's local frame, plus a slow wander
  if (camera) {
   _E.copy(camera.position); s.gemGrp.worldToLocal(_E);
   _E.x += Math.sin(t*0.5 + s.phase)*0.5; _E.y += Math.cos(t*0.37 + s.phase)*0.35;
   s.eyeParts.eye.lookAt(_E);
  }
  s.gemGrp.rotation.z = Math.sin(t*1.1 + s.phase)*0.05;
  s.halo.rotation.z += (1.0 + s.hot*3)*dt;
  s.gemGrp.scale.setScalar(1.3 + s.hot*0.28 + pulseValue*0.14);
  const blink = Math.max(0, 1 - Math.abs(((t*0.28 + s.phase) % 4) - 0.12)*9);
  s.eyeParts.eye.scale.set(1, 1 - blink*0.9, 1);
  const flicker = 0.5 + 0.5*Math.sin(t*3 + s.phase*2);
  s.m.emissiveIntensity = 1.8 + flicker*0.6 + s.hot*2.5 + pulseValue*1.8;
  s.eyeParts.pupil.scale.setScalar(1 - 0.12*flicker - s.hot*0.18 + pulseValue*0.25);
  s.glowRing.material.emissiveIntensity = 1.5 + flicker + s.hot*3 + pulseValue*2;
  s.light.intensity = 3.5 + flicker*2 + s.hot*10 + pulseValue*8;
  s.sigilMat.opacity = 0.26 + flicker*0.1 + s.hot*0.35 + pulseValue*0.3;
  s.threadMat.opacity = 0.5 + flicker*0.2 + s.hot*0.4 + pulseValue*0.3;
  s.glowMat.opacity = 0.14 + flicker*0.08 + s.hot*0.35 + pulseValue*0.35;
  s.beadT += dt*(0.32 + s.hot*0.5 + pulseValue*1.2);
  if (s.beadT > 1.15) s.beadT = -0.15 - random()*0.5;
  const bt = THREE.MathUtils.clamp(s.beadT, 0, 1);
  s.curve.getPoint(1 - bt, _B); s.bead.position.copy(_B);
  s.beadMat.opacity = s.beadT >= 0 && s.beadT <= 1 ? 0.5 + Math.sin(bt*Math.PI)*0.5 : 0;
  s.bead.scale.setScalar(1 + s.hot*0.8 + pulseValue*1.2);
  s.pulseT += dt*(0.45 + s.hot*0.6 + pulseValue*0.8);
  if (s.pulseT > 1.25) s.pulseT = -0.2 - random()*0.6;
  const pt = THREE.MathUtils.clamp(s.pulseT, 0, 1), rr = s.R - pt*(s.R - 1.62);
  s.pulseMesh.position.set(Math.cos(s.ang)*rr, 0.26 + Math.sin(pt*Math.PI)*0.04, Math.sin(s.ang)*rr);
  s.pulseMat.opacity = s.pulseT >= 0 && s.pulseT <= 1 ? 0.6 + Math.sin(pt*Math.PI)*0.4 : 0;
  s.pulseMesh.scale.setScalar(1 + s.hot + pulseValue*1.5);
  s.chanMat.emissiveIntensity = 0.9 + Math.sin(pt*Math.PI)*0.9 + s.hot*1.2 + pulseValue*2;
 }
}
function pulse(key = lastHover) {
 if (disposed) return;
 pulseValue = 1; shockT = 1; irisSpin += 6;
 for (const s of stations) { s.pulseT = 0; if (s.a.key === key) s.hot = Math.max(s.hot, 1.2); }
}
// Give a still or reduced-motion mount a fully placed scene on the first paint.
update(0);
const geometries = new Set(), materials = new Set();
model.traverse(o => { if (o.geometry) geometries.add(o.geometry); if (Array.isArray(o.material)) { for (const m of o.material) materials.add(m); } else if (o.material) materials.add(o.material); });
return { root: model, core, disc, iris, blades, bladeEdges, layers, shards, stations, pylons, M, coreLight, backLight,
 coreCrystal: sun, sun, hole, accretion, accretion2, infall, dust, shock, ringShock, effects,
 pickables, corePickables, occluders, coreOccluders, update, pulse,
 get time() { return time; }, get pulseValue() { return pulseValue; }, get shockT() { return shockT; },
 get irisSpin() { return irisSpin; }, get coreHotV() { return coreHotV; }, get flash() { return pulseValue*0.55; },
 dispose() { if (disposed) return; disposed = true; for (const g of geometries) g.dispose(); for (const m of materials) m.dispose(); model.removeFromParent(); model.clear(); }
};
}
