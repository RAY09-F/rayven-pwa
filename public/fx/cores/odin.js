/* ASGARD FX — ODIN ARC CORE. Strike Three, Phase 3.
   A nested iris: eight gold aperture blades on a bronze ring, opening and
   closing over a light held at the centre, inside three nested toroidal
   pieces in pearl and bronze that precess slowly — on a stepped plum plinth
   over the dark polished floor. Thinking closes the iris in one slow build
   and it resolves; it never loops. Real geometry, authored motion, no
   per-frame allocation. Loaded BY asgard-fx.js; renders inside the engine's
   WebGL2 context. Contract: docs/CORE_MODULE_CONTRACT.md. */
(function () {
  'use strict';
  const FX = window.AsgardFX;
  if (!FX || !FX.registerCore) return;

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const ease = (v, target, dt, tau) => v + (target - v) * (dt <= 0 ? 0 : Math.min(1, dt / tau));

  const RELIC_Y = 0.55, FLOOR_Y = -0.95;
  const PLINTH = [[1.75, 0.10], [1.35, 0.12], [1.00, 0.16]];
  const COL = { core: 0xD8AE5A, rim: 0xA56429, pearl: 0xECEAF2, silver: 0xC8D1DC, plum: 0x292337, void: 0x0B0A12, petrol: 0x285E6B, uv: 0x7965CF, floor: 0x14111D, bronze: 0x8A5A2B };
  const RING_RGB = [216, 174, 90];
  const BLADES = 8, IRIS_R = 0.78;                                   // hinge radius of the blades
  // the toroidal pieces: major radius, tube radius, tilt (x, z), precession rate rad/s
  const TORI = [
    { R: 1.05, r: 0.055, tilt: [1.35, 0.15], spin: 0.045, mat: 'pearl' },
    { R: 1.38, r: 0.045, tilt: [0.35, 1.2], spin: -0.03, mat: 'bronze' },
    { R: 1.68, r: 0.06, tilt: [1.05, -0.7], spin: 0.02, mat: 'pearl' }
  ];

  function makeEnv(THREE, renderer) {
    if (!THREE.PMREMGenerator) return null;
    const sc = new THREE.Scene(); sc.background = new THREE.Color(COL.void); const bits = [];
    const panel = (col, k, w, h, x, y, z, rx, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); m.material.color.multiplyScalar(k); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); sc.add(m); bits.push(m); };
    panel(COL.pearl, 4.5, 4, 2, 0, 5, 1, Math.PI / 2, 0); panel(COL.petrol, 2.0, 6, 3, -6, 1, 2, 0, Math.PI / 2); panel(COL.uv, 1.0, 8, 4, 0, 2, -7, 0, 0); panel(COL.core, 1.6, 5, 1, 0, -1.5, 5, 0, Math.PI);
    const pm = new THREE.PMREMGenerator(renderer); const rt = pm.fromScene(sc, 0.05); pm.dispose();
    for (const m of bits) { m.geometry.dispose(); m.material.dispose(); }
    return rt;
  }

  const M = { state: 'idle', since: 0, open: 0.62, openT: 0.62, amb: 1, ambT: 1, emis: 0.5, emisT: 0.5, inner: 4, innerT: 4, close: null, flare: 0, lastPeak: -9, prevLevel: 0, spin: [0, 0, 0], yaw: 0, t: 0, sel: null };
  const O = {};
  let C = null, built = false;

  function build(THREE) {
    const mats = O.mats = {
      blade: new THREE.MeshStandardMaterial({ color: COL.core, emissive: COL.core, emissiveIntensity: 0.15, roughness: 0.3, metalness: 0.75, flatShading: true, envMapIntensity: 1.0, side: THREE.DoubleSide }),
      pupil: new THREE.MeshStandardMaterial({ color: COL.core, emissive: COL.core, emissiveIntensity: 0.6, roughness: 0.5, metalness: 0.0 }),
      ring: new THREE.MeshStandardMaterial({ color: COL.bronze, roughness: 0.38, metalness: 0.85, envMapIntensity: 1.0 }),
      pearl: new THREE.MeshPhysicalMaterial({ color: COL.pearl, roughness: 0.32, metalness: 0.08, clearcoat: 0.5, clearcoatRoughness: 0.25, envMapIntensity: 0.9 }),
      bronze: new THREE.MeshStandardMaterial({ color: COL.rim, roughness: 0.35, metalness: 0.9, emissive: COL.rim, emissiveIntensity: 0, envMapIntensity: 1.0 }),
      plum: new THREE.MeshStandardMaterial({ color: COL.plum, roughness: 0.45, metalness: 0.25, envMapIntensity: 0.6 }),
      rim: new THREE.MeshStandardMaterial({ color: COL.silver, roughness: 0.3, metalness: 0.9, envMapIntensity: 1.0 }),
      floor: new THREE.MeshStandardMaterial({ color: COL.floor, roughness: 0.28, metalness: 0.55, transparent: true, opacity: 0.84, envMapIntensity: 0.5 })
    };
    const geos = O.geos = [], root = O.root = new THREE.Group();
    const floorG = new THREE.CircleGeometry(9, 48); geos.push(floorG);
    O.floor = new THREE.Mesh(floorG, mats.floor); O.floor.rotation.x = -Math.PI / 2; O.floor.position.y = FLOOR_Y; root.add(O.floor);
    let y = FLOOR_Y;
    for (const [r, h] of PLINTH) { const g = new THREE.CylinderGeometry(r, r, h, 48); geos.push(g); const m = new THREE.Mesh(g, mats.plum); m.position.y = y + h / 2; root.add(m); y += h; }
    const rimG = new THREE.CylinderGeometry(PLINTH[2][0] + 0.004, PLINTH[2][0] + 0.004, 0.02, 64, 1, true); geos.push(rimG);
    const rim = new THREE.Mesh(rimG, mats.rim); rim.position.y = y - 0.01; root.add(rim);
    const discG = new THREE.RingGeometry(PLINTH[2][0] - 0.035, PLINTH[2][0] + 0.004, 64); geos.push(discG);
    const disc = new THREE.Mesh(discG, mats.rim); disc.rotation.x = -Math.PI / 2; disc.position.y = y + 0.001; root.add(disc);
    // the relic: iris ring facing the room, blades hinged on it, a light behind them
    const relic = O.relic = new THREE.Group(); relic.position.y = RELIC_Y; if(C.presentation==='focused')relic.scale.setScalar(1.13); root.add(relic);
    const irisRingG = new THREE.TorusGeometry(IRIS_R + 0.06, 0.05, 8, 40); geos.push(irisRingG);
    O.irisRing = new THREE.Mesh(irisRingG, mats.ring); relic.add(O.irisRing);
    if(C.presentation==='focused'){
      const marker=new THREE.BoxGeometry(.035,.17,.055);geos.push(marker);
      for(let i=0;i<16;i++){const a=i*TAU/16,m=new THREE.Mesh(marker,i%4===0?mats.pupil:mats.blade);m.position.set(Math.sin(a)*.95,Math.cos(a)*.95,.015);m.rotation.z=-a;O.irisRing.add(m);}
    }
    let bladeG;
    if(C.presentation==='focused'){
      const profile=new THREE.Shape();profile.moveTo(0,-0.12);profile.lineTo(-0.72,-0.10);profile.lineTo(-0.84,0.05);profile.lineTo(-0.34,0.19);profile.lineTo(0,0.12);profile.closePath();
      bladeG=new THREE.ExtrudeGeometry(profile,{depth:0.035,bevelEnabled:true,bevelSize:0.006,bevelThickness:0.006,bevelSegments:1,steps:1});bladeG.translate(0,0,-0.0175);
    }else{bladeG=new THREE.BoxGeometry(0.86,0.26,0.035);bladeG.translate(-0.43,0,0);}
    geos.push(bladeG);   // hinged at its outer end
    O.blades = [];
    for (let i = 0; i < BLADES; i++) {
      const hinge = new THREE.Group(); const a = (i / BLADES) * TAU; hinge.position.set(Math.cos(a) * IRIS_R, Math.sin(a) * IRIS_R, (i % 2) * 0.03 - 0.015); hinge.rotation.z = a;
      const blade = new THREE.Mesh(bladeG, mats.blade); hinge.add(blade); relic.add(hinge); O.blades.push(hinge);
    }
    const pupilG = new THREE.SphereGeometry(0.22, 16, 12); geos.push(pupilG);
    O.pupil = new THREE.Mesh(pupilG, mats.pupil); O.pupil.position.z = -0.08; relic.add(O.pupil);
    // the toroidal pieces
    O.tori = []; O.axes = [];
    for (const t of TORI) {
      const g = new THREE.TorusGeometry(t.R, t.r, 8, 44); geos.push(g);
      const m = new THREE.Mesh(g, mats[t.mat]); m.rotation.set(t.tilt[0], 0, t.tilt[1]); relic.add(m); O.tori.push(m);
      O.axes.push(new THREE.Vector3(0, 0, 1).applyEuler(m.rotation).normalize());   // the torus's own axis, for precession
      m.userData.base = m.quaternion.clone();
    }
    // reflection under the floor
    const mirror = O.mirror = new THREE.Group(); mirror.scale.y = -1; mirror.position.y = 2 * FLOOR_Y; root.add(mirror);
    O.mirRelic = relic.clone(); mirror.add(O.mirRelic);
    const L = O.lights = {
      key: new THREE.DirectionalLight(COL.pearl, 2.0), fill: new THREE.DirectionalLight(COL.petrol, 0.8), rim: new THREE.DirectionalLight(COL.rim, 1.8),
      hemi: new THREE.HemisphereLight(COL.uv, COL.void, 0.28), inner: new THREE.PointLight(COL.core, 4, 6, 2)
    };
    L.key.position.set(2.5, 4, 3); L.fill.position.set(-3, 1, 2); L.rim.position.set(-1.5, 2.5, -3.5); L.inner.position.set(0, RELIC_Y, 0.4);
    for (const k in L) root.add(L[k]);
    O.look = new THREE.Vector3(0, RELIC_Y - 0.1, 0); O.crystalWorld = new THREE.Vector3(0, RELIC_Y, 0); O.tmpQ = new THREE.Quaternion(); O.ringOut = { x: 0, y: 0 };
    return root;
  }
  function applyIris(open) {
    // open 0 = closed (blades meet at the centre), 1 = fully open (blades lie along the ring)
    const focused = C?.presentation === 'focused';
    const ang = focused ? 0.05 + open * 0.90 : 0.05 + (1 - open) * 1.15;
    for (let i = 0; i < BLADES; i++) O.blades[i].rotation.z = (i / BLADES) * TAU + (focused ? 0 : Math.PI) - ang;
    if (O.mirRelic) { const mb = O.mirRelic.children; for (let i = 0; i < BLADES; i++) { const h = mb[1 + i]; if (h) h.rotation.z = O.blades[i].rotation.z; } }
  }

  const CORE = {
    init(ctx) {
      C = ctx; const THREE = ctx.THREE;
      ctx.scene.add(build(THREE));
      try { O.env = ctx.tier === 'svg' ? null : makeEnv(THREE, ctx.renderer); if (O.env) ctx.scene.environment = O.env.texture; } catch (e) { console.warn('[odin core] environment map unavailable, lights only:', e && e.message); O.env = null; }
      built = true; applyIris(M.open);
      this.resize(ctx.w, ctx.h); this.setQuality(ctx.quality);
    },
    setState(s, level) {
      if (s !== M.state) { M.since = 0; M.close = s === 'thinking' ? { t: 0, d: 1.8, from: M.open, hold: 0.9 } : null; }
      M.state = s; if (typeof level === 'number' && isFinite(level)) M.prevLevel = level;
    },
    select(id) { M.sel = id || null; },
    anchor() { return O.crystalWorld; },
    setQuality(q) { if (!built) return; O.mirror.visible = q < 2; },
    update(dt) {
      if (!built) return;
      dt = dt > 0 ? Math.min(dt, 0.1) : 0; M.t += dt; M.since += dt;
      const level = C.level, st = M.state, speaking = st === 'speaking';
      if (st === 'listening') { M.openT = 0.85; M.ambT = 0.72; M.emisT = 0.7; M.innerT = 5; }
      else if (st === 'thinking') { M.ambT = 0.85; M.emisT = 0.55 + 0.15 * Math.sin(M.t * 1.1); M.innerT = 5; }
      else { M.openT = 0.62; M.ambT = 1; M.emisT = 0.5; M.innerT = 4; }
      const snap = M.since > 1.5;
      M.amb = snap ? M.ambT : ease(M.amb, M.ambT, dt, 0.5);
      M.emis = speaking ? 0.5 + 1.2 * level : ease(M.emis, M.emisT, dt, 0.35);
      M.inner = speaking ? 4 + 10 * level : ease(M.inner, M.innerT, dt, 0.35);
      if (M.close) {                                                   // thinking: one slow close, a hold, then it opens again and rests. It resolves; it never loops.
        const c = M.close; c.t += dt;
        if (c.t < c.d) M.open = c.from + (0.06 - c.from) * smooth(c.t / c.d);
        else if (c.t < c.d + c.hold) M.open = 0.06;
        else if (c.t < c.d + c.hold + 2.0) M.open = 0.06 + (0.5 - 0.06) * smooth((c.t - c.d - c.hold) / 2.0);
        else { M.open = 0.5; M.close = null; M.openT = 0.5; }
        if (c.t > 6) { M.open = 0.5; M.close = null; M.openT = 0.5; }   // deadline
      } else M.open = snap ? M.openT : ease(M.open, M.openT + (speaking ? 0.12 * level : 0), dt, 0.45);
      M.yaw = 0.05 * Math.sin(M.t * TAU / 38);
      for (let i = 0; i < 3; i++) M.spin[i] += dt * TORI[i].spin * (st === 'listening' ? 0.4 : 1);
      if (speaking && level > 0.7 && M.prevLevel <= 0.7 && M.t - M.lastPeak > 0.6) {
        M.lastPeak = M.t; M.flare = 1;
        const p = C.project(O.crystalWorld, O.ringOut); C.ring(p.x, p.y, RING_RGB, 700, 2, 260);
      }
      M.prevLevel = level;
      if (M.flare > 0) M.flare = Math.max(0, M.flare - dt / 0.4);
      // apply
      O.relic.rotation.y = M.yaw; applyIris(M.open);
      for (let i = 0; i < 3; i++) { O.tmpQ.setFromAxisAngle(O.axes[i], M.spin[i]); O.tori[i].quaternion.copy(O.tmpQ).multiply(O.tori[i].userData.base); }
      if (O.mirror.visible) { O.mirRelic.rotation.y = M.yaw; const mc = O.mirRelic.children; for (let i = 0; i < 3; i++) { const t = mc[1 + BLADES + 1 + i]; if (t) t.quaternion.copy(O.tori[i].quaternion); } }
      const L = O.lights;
      L.hemi.intensity = 0.28 * M.amb; L.key.intensity = 2.0 * (0.8 + 0.2 * M.amb); L.fill.intensity = 0.8 * M.amb; L.inner.intensity = M.inner + M.flare * 8;
      O.mats.pupil.emissiveIntensity = M.emis + M.flare * 1.5; O.mats.blade.emissiveIntensity = 0.15 + 0.25 * M.flare; O.mats.bronze.emissiveIntensity = M.flare * 0.6;
    },
    resize(w, h) {
      if (!C || !built) return;
      const cam = C.camera, aspect = Math.max(0.2, w / Math.max(1, h));
      const d = aspect < 1 ? 6.4 + (1 - aspect) * 3.2 : 6.4;
      cam.position.set(0, 1.45, d); cam.fov = clamp(2 * Math.atan(2.35 / (d * aspect)) * 180 / Math.PI, 30, 58);
      cam.aspect = aspect; cam.near = 0.1; cam.far = 80; cam.updateProjectionMatrix(); cam.lookAt(O.look);
    },
    dispose() {
      if (!built) return; built = false;
      try { if (C && C.scene) { C.scene.remove(O.root); if (C.scene.environment === (O.env && O.env.texture)) C.scene.environment = null; } } catch (e) {}
      for (const g of O.geos) { try { g.dispose(); } catch (e) {} }
      for (const k in O.mats) { try { O.mats[k].dispose(); } catch (e) {} }
      if (O.env) { try { O.env.dispose(); } catch (e) {} }
      for (const k in O) delete O[k];
      C = null;
    },
    draw2d(ctx, W, H, c) {
      const s = Math.min(W, H) * 0.20, lv = c ? c.level : 0, glow = M.state === 'speaking' ? 0.35 + 0.65 * lv : 0.35;
      ctx.save(); ctx.translate(W / 2, H * 0.5);
      let g = ctx.createRadialGradient(0, s * 1.5, 0, 0, s * 1.5, s * 2.4); g.addColorStop(0, 'rgba(216,174,90,' + (0.2 * glow).toFixed(3) + ')'); g.addColorStop(1, 'rgba(216,174,90,0)');
      ctx.fillStyle = g; ctx.fillRect(-s * 3.2, s * 0.3, s * 6.4, s * 2.8);
      const steps = [[1.75, 1.42], [1.35, 1.32], [1.0, 1.2]];
      for (let i = 0; i < 3; i++) { const r = steps[i][0] * s * 0.7, y = s * steps[i][1]; ctx.fillStyle = i === 2 ? '#302941' : '#292337'; ctx.beginPath(); ctx.ellipse(0, y, r, r * 0.32, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(200,209,220,' + (i === 2 ? 0.75 : 0.28) + ')'; ctx.lineWidth = Math.max(1, s * 0.012); ctx.stroke(); }
      const tor = (R, rot, col, w) => { ctx.save(); ctx.rotate(rot); ctx.strokeStyle = col; ctx.lineWidth = w; ctx.beginPath(); ctx.ellipse(0, 0, R * s, R * s * 0.35, 0, 0, TAU); ctx.stroke(); ctx.restore(); };
      tor(1.68, 1.05, '#ECEAF2', s * 0.06); tor(1.38, -0.5, '#A56429', s * 0.045);
      g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 0.9); g.addColorStop(0, 'rgba(216,174,90,' + (0.7 * glow).toFixed(3) + ')'); g.addColorStop(1, 'rgba(216,174,90,0)'); ctx.fillStyle = g; ctx.fillRect(-s, -s, s * 2, s * 2);
      ctx.strokeStyle = '#8A5A2B'; ctx.lineWidth = s * 0.08; ctx.beginPath(); ctx.arc(0, 0, IRIS_R * s, 0, TAU); ctx.stroke();
      const open = M.open, inner = IRIS_R * s * (0.12 + 0.8 * open);
      for (let i = 0; i < BLADES; i++) { const a = (i / BLADES) * TAU, b = a + TAU / BLADES; ctx.fillStyle = i % 2 ? '#D8AE5A' : '#C79B4C'; ctx.beginPath(); ctx.moveTo(Math.cos(a) * IRIS_R * s, Math.sin(a) * IRIS_R * s); ctx.lineTo(Math.cos(b) * IRIS_R * s, Math.sin(b) * IRIS_R * s); ctx.lineTo(Math.cos(b + 0.35) * inner, Math.sin(b + 0.35) * inner); ctx.lineTo(Math.cos(a + 0.35) * inner, Math.sin(a + 0.35) * inner); ctx.closePath(); ctx.fill(); }
      tor(1.05, 1.35, '#ECEAF2', s * 0.05);
      ctx.restore();
    }
  };
  FX.registerCore('odin', CORE);
})();
