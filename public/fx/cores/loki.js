/* ASGARD FX — LOKI ARC CORE. Strike Three, Phase 1 (the spike).
   The Impossible Relic, Loki's version: a solid faceted citrine crystal held
   inside an asymmetric looping shell of opalescent pearl ribbons with silver
   edges, on a stepped plum plinth over a dark polished floor.
   Real geometry (about 7k triangles with the floor reflection, 4k without),
   authored motion, no per-frame allocation. Loaded BY asgard-fx.js and
   rendered inside the engine's own WebGL2 context through Three.js.
   Contract: docs/CORE_MODULE_CONTRACT.md. */
(function () {
  'use strict';
  const FX = window.AsgardFX;
  if (!FX || !FX.registerCore) return;

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const smooth = t => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  const ease = (v, target, dt, tau) => v + (target - v) * (dt <= 0 ? 0 : Math.min(1, dt / tau));

  // ------------------------------------------------------------------ spec
  // Ribbons: planar ellipses (radii a, b) rotated by Euler angles (x, y, z),
  // offset from the crystal's centre, swept by a flat cross-section (width w,
  // thickness th) that twists `twist` half-turns around the loop, and turning
  // slowly about their own plane normal at `spin` rad/s. The numbers were
  // chosen by a numeric search so no loop touches another loop, the crystal,
  // or the plinth (closest approach 0.33 between loops, 0.43 to the crystal).
  const RIBBONS = [
    { a: 1.55, b: 1.15, rot: [0.45, 0.00, 0.35], off: [0.00, 0.05, 0.00], w: 0.26, th: 0.045, twist: 1, seg: 128, spin: 0.030 },
    { a: 1.22, b: 0.85, rot: [-1.04, 0.86, -0.81], off: [-0.10, 0.23, 0.12], w: 0.20, th: 0.040, twist: 0, seg: 112, spin: -0.022 },
    { a: 1.59, b: 0.95, rot: [1.02, -0.19, -0.41], off: [-0.04, 0.08, -0.02], w: 0.16, th: 0.035, twist: 2, seg: 128, spin: 0.018 }
  ];
  // The crystal: an elongated hexagonal bipyramid with a narrow girdle band,
  // a little taller above the girdle than below (asymmetry reads as "cut").
  const CRYSTAL = { top: 1.05, bottom: 0.95, girdle: 0.40, sides: 6, waist: 0.12 };
  const RELIC_Y = 0.55;                 // height of the crystal's centre over the floor origin
  const FLOOR_Y = -0.95;
  const PLINTH = [[1.75, 0.10], [1.35, 0.12], [1.00, 0.16]];   // [radius, height], stacked from the floor up
  const COL = { core: 0xE7C24A, deep: 0xD8AF5C, pearl: 0xECEAF2, silver: 0xC8D1DC, plum: 0x292337, void: 0x0B0A12, petrol: 0x285E6B, uv: 0x7965CF, floor: 0x14111D };
  const RING_RGB = [231, 194, 74];

  // ------------------------------------------------------- path maths
  function rotMat(r) {
    const cx = Math.cos(r[0]), sx = Math.sin(r[0]), cy = Math.cos(r[1]), sy = Math.sin(r[1]), cz = Math.cos(r[2]), sz = Math.sin(r[2]);
    return [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx, sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx, -sy, cy * sx, cy * cx];   // Rz * Ry * Rx
  }
  function mul(m, x, y, z, o, i) { o[i] = m[0] * x + m[1] * y + m[2] * z; o[i + 1] = m[3] * x + m[4] * y + m[5] * z; o[i + 2] = m[6] * x + m[7] * y + m[8] * z; }
  // out: [px,py,pz, tx,ty,tz, ux,uy,uz] — position (loop-centred), unit tangent, unit plane normal
  function pathAt(spec, t, out) {
    const m = spec._m || (spec._m = rotMat(spec.rot)), th = t * TAU, c = Math.cos(th), s = Math.sin(th);
    mul(m, spec.a * c, 0, spec.b * s, out, 0);
    mul(m, -spec.a * s, 0, spec.b * c, out, 3); const tl = Math.hypot(out[3], out[4], out[5]) || 1; out[3] /= tl; out[4] /= tl; out[5] /= tl;
    mul(m, 0, 1, 0, out, 6);
    return out;
  }

  // --------------------------------------------------------- geometry
  function buildRibbon(THREE, spec) {
    const N = spec.seg, rings = N + 1, hw = spec.w / 2 * (C?.presentation === 'focused' ? 0.48 : 1), ht = spec.th / 2;
    // four faces, each its own strip so the edges stay sharp:
    // 0 top (pearl) · 1 bottom (pearl) · 2 outer edge (silver) · 3 inner edge (silver)
    const pos = new Float32Array(4 * rings * 2 * 3), nor = new Float32Array(4 * rings * 2 * 3), idx = new Uint16Array(4 * N * 6);
    const f = new Float64Array(9), A = [0, 0, 0], B = [0, 0, 0], R = [0, 0, 0];
    const put = (face, slot, j, sa, sb, nx, ny, nz) => {
      const v = ((face * rings + j) * 2 + slot) * 3;
      pos[v] = f[0] + A[0] * sa * hw + B[0] * sb * ht; pos[v + 1] = f[1] + A[1] * sa * hw + B[1] * sb * ht; pos[v + 2] = f[2] + A[2] * sa * hw + B[2] * sb * ht;
      nor[v] = nx; nor[v + 1] = ny; nor[v + 2] = nz;
    };
    for (let j = 0; j < rings; j++) {
      const t = j / N; pathAt(spec, t, f);
      R[0] = f[4] * f[8] - f[5] * f[7]; R[1] = f[5] * f[6] - f[3] * f[8]; R[2] = f[3] * f[7] - f[4] * f[6];   // T × U: in-plane, across the loop
      const phi = t * Math.PI * spec.twist, cp = Math.cos(phi), sp = Math.sin(phi);
      for (let k = 0; k < 3; k++) { A[k] = f[6 + k] * cp + R[k] * sp; B[k] = -f[6 + k] * sp + R[k] * cp; }   // A: width direction, B: thickness direction
      put(0, 0, j, -1, 1, B[0], B[1], B[2]); put(0, 1, j, 1, 1, B[0], B[1], B[2]);
      put(1, 0, j, 1, -1, -B[0], -B[1], -B[2]); put(1, 1, j, -1, -1, -B[0], -B[1], -B[2]);
      put(2, 0, j, 1, 1, A[0], A[1], A[2]); put(2, 1, j, 1, -1, A[0], A[1], A[2]);
      put(3, 0, j, -1, -1, -A[0], -A[1], -A[2]); put(3, 1, j, -1, 1, -A[0], -A[1], -A[2]);
    }
    let q = 0;
    for (let face = 0; face < 4; face++) for (let j = 0; j < N; j++) {
      const a = (face * rings + j) * 2, b = a + 2;
      idx[q++] = a; idx[q++] = b + 1; idx[q++] = a + 1; idx[q++] = a; idx[q++] = b; idx[q++] = b + 1;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.addGroup(0, N * 12, 0); g.addGroup(N * 12, N * 12, 1);
    return g;
  }
  function buildCrystal(THREE) {
    const n = CRYSTAL.sides, g = CRYSTAL.girdle, hw = CRYSTAL.waist / 2, tris = [];
    const ring = y => { const r = []; for (let i = 0; i < n; i++) { const a = (i / n) * TAU + Math.PI / n; r.push([g * Math.cos(a), y, g * Math.sin(a)]); } return r; };
    const up = ring(hw), lo = ring(-hw), apexT = [0, hw + CRYSTAL.top, 0], apexB = [0, -hw - CRYSTAL.bottom, 0];
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      tris.push(apexT, up[j], up[i]);                     // upper facets
      tris.push(up[i], up[j], lo[j], up[i], lo[j], lo[i]); // girdle band
      tris.push(apexB, lo[i], lo[j]);                     // lower facets
    }
    const pos = new Float32Array(tris.length * 3);
    for (let i = 0; i < tris.length; i++) { pos[i * 3] = tris[i][0]; pos[i * 3 + 1] = tris[i][1]; pos[i * 3 + 2] = tris[i][2]; }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3)); geo.computeVertexNormals();
    return geo;
  }
  // A small emissive "room" baked once into a prefiltered environment map so
  // pearl, silver and the polished floor have something real to reflect.
  function makeEnv(THREE, renderer) {
    if (!THREE.PMREMGenerator) return null;
    const sc = new THREE.Scene(); sc.background = new THREE.Color(COL.void);
    const bits = [];
    const panel = (col, k, w, h, x, y, z, rx, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); m.material.color.multiplyScalar(k); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); sc.add(m); bits.push(m); };
    panel(COL.pearl, 5.0, 4, 2, 0, 5, 1, Math.PI / 2, 0);     // key, from above and slightly in front
    panel(COL.petrol, 2.2, 6, 3, -6, 1, 2, 0, Math.PI / 2);   // cool fill, left
    panel(COL.uv, 1.1, 8, 4, 0, 2, -7, 0, 0);                 // violet haze, behind
    panel(COL.core, 1.4, 5, 1, 0, -1.5, 5, 0, Math.PI);       // warm strip, low in front
    const pm = new THREE.PMREMGenerator(renderer); const rt = pm.fromScene(sc, 0.05); pm.dispose();
    for (const m of bits) { m.geometry.dispose(); m.material.dispose(); }
    return rt;
  }

  // ------------------------------------------------------------- state
  const M = { state: 'idle', since: 0, shell: 1, shellT: 1, amb: 1, ambT: 1, emis: 0.4, emisT: 0.4, inner: 3, innerT: 3, relicYaw: 0, shellYaw: 0, turn: null, flare: 0, lastPeak: -9, prevLevel: 0, spin: [0, 0, 0], breath: 1, t: 0 };
  const O = {};        // scene objects, built in init, released in dispose
  let C = null, built = false;

  function build(THREE) {
    const mats = O.mats = {
      crystal: new THREE.MeshStandardMaterial({ color: COL.core, emissive: COL.core, emissiveIntensity: 0.4, roughness: 0.22, metalness: 0.05, flatShading: true, envMapIntensity: 0.35 }),
      pearl: new THREE.MeshPhysicalMaterial({ color: COL.pearl, roughness: 0.32, metalness: 0.08, clearcoat: 0.55, clearcoatRoughness: 0.25, iridescence: 0.45, iridescenceIOR: 1.35, iridescenceThicknessRange: [120, 480], side: THREE.DoubleSide, envMapIntensity: 0.9 }),
      silver: new THREE.MeshStandardMaterial({ color: COL.silver, roughness: 0.28, metalness: 0.92, emissive: COL.core, emissiveIntensity: 0, side: THREE.DoubleSide, envMapIntensity: 1.0 }),
      plum: new THREE.MeshStandardMaterial({ color: COL.plum, roughness: 0.45, metalness: 0.25, envMapIntensity: 0.6 }),
      rim: new THREE.MeshStandardMaterial({ color: COL.silver, roughness: 0.3, metalness: 0.9, envMapIntensity: 1.0 }),
      floor: new THREE.MeshStandardMaterial({ color: COL.floor, roughness: 0.28, metalness: 0.55, transparent: true, opacity: 0.84, envMapIntensity: 0.5 })
    };
    const geos = O.geos = [];
    const root = O.root = new THREE.Group();
    // floor
    const floorG = new THREE.CircleGeometry(9, 48); geos.push(floorG);
    O.floor = new THREE.Mesh(floorG, mats.floor); O.floor.rotation.x = -Math.PI / 2; O.floor.position.y = FLOOR_Y; root.add(O.floor);
    // plinth: three steps and a silver rim on the top step
    let y = FLOOR_Y;
    for (const [r, h] of PLINTH) { const g = new THREE.CylinderGeometry(r, r, h, 48); geos.push(g); const m = new THREE.Mesh(g, mats.plum); m.position.y = y + h / 2; root.add(m); y += h; }
    O.plinthTop = y;
    const rimG = new THREE.CylinderGeometry(PLINTH[2][0] + 0.004, PLINTH[2][0] + 0.004, 0.02, 64, 1, true); geos.push(rimG);
    const rim = new THREE.Mesh(rimG, mats.rim); rim.position.y = y - 0.01; root.add(rim);
    const discG = new THREE.RingGeometry(PLINTH[2][0] - 0.035, PLINTH[2][0] + 0.004, 64); geos.push(discG);
    const disc = new THREE.Mesh(discG, mats.rim); disc.rotation.x = -Math.PI / 2; disc.position.y = y + 0.001; root.add(disc);
    // the relic: crystal + shell
    const relic = O.relic = new THREE.Group(); relic.position.y = RELIC_Y; if(C.presentation==='focused')relic.scale.setScalar(1.13); root.add(relic);
    const crystalG = buildCrystal(THREE); geos.push(crystalG);
    O.crystal = new THREE.Mesh(crystalG, mats.crystal); relic.add(O.crystal);
    if(C.presentation==='focused'){
      const facets=new THREE.EdgesGeometry(crystalG,22);geos.push(facets);
      mats.facets=new THREE.LineBasicMaterial({color:0xffedab,transparent:true,opacity:.55});
      O.crystal.add(new THREE.LineSegments(facets,mats.facets));
    }
    const shell = O.shell = new THREE.Group(); relic.add(shell);
    O.ribbons = []; O.axes = [];
    for (const spec of RIBBONS) {
      const g = buildRibbon(THREE, spec); geos.push(g);
      const m = new THREE.Mesh(g, [mats.pearl, mats.silver]); m.position.set(spec.off[0], spec.off[1], spec.off[2]); shell.add(m); O.ribbons.push(m);
      const mm = rotMat(spec.rot); O.axes.push(new THREE.Vector3(mm[1], mm[4], mm[7]).normalize());   // the loop's plane normal
    }
    // the reflection: the relic mirrored below the (semi-transparent) floor. Shares every geometry and material.
    const mirror = O.mirror = new THREE.Group(); mirror.scale.y = -1; mirror.position.y = 2 * FLOOR_Y; root.add(mirror);
    O.mirRelic = relic.clone(); mirror.add(O.mirRelic);
    O.mirCrystal = O.mirRelic.children[0]; O.mirShell = O.mirRelic.children[1]; O.mirRibbons = O.mirShell.children;
    // lights: one key, one cool fill, one rim, a little ambient bounce, and the light inside the crystal
    const L = O.lights = {
      key: new THREE.DirectionalLight(COL.pearl, 2.2), fill: new THREE.DirectionalLight(COL.petrol, 0.9), rim: new THREE.DirectionalLight(COL.deep, 1.6),
      hemi: new THREE.HemisphereLight(COL.uv, COL.void, 0.28), inner: new THREE.PointLight(COL.core, 3, 6, 2)
    };
    L.key.position.set(2.5, 4, 3); L.fill.position.set(-3, 1, 2); L.rim.position.set(-1.5, 2.5, -3.5); L.inner.position.set(0, RELIC_Y, 0);
    for (const k in L) root.add(L[k]);
    O.look = new THREE.Vector3(0, RELIC_Y - 0.1, 0);
    O.crystalWorld = new THREE.Vector3(0, RELIC_Y, 0);
    O.tmpQ = new THREE.Quaternion(); O.ringOut = { x: 0, y: 0 };
    return root;
  }

  const CORE = {
    init(ctx) {
      C = ctx; const THREE = ctx.THREE;
      ctx.scene.add(build(THREE));
      try { O.env = ctx.tier === 'svg' ? null : makeEnv(THREE, ctx.renderer); if (O.env) ctx.scene.environment = O.env.texture; }
      catch (e) { console.warn('[loki core] environment map unavailable, lights only:', e && e.message); O.env = null; }
      built = true;
      this.resize(ctx.w, ctx.h);
      this.setQuality(ctx.quality);
    },
    setState(s, level) {
      if (s !== M.state) {
        M.since = 0;
        M.turn = s === 'thinking' ? { t: 0, d: 2.4, from: M.shellYaw, to: M.shellYaw + Math.PI / 2 } : null;   // one quarter turn, then it resolves
      }
      M.state = s;
      if (typeof level === 'number' && isFinite(level)) M.prevLevel = level;
    },
    select(advisorId) { M.sel = advisorId || null; },              // the council lights the tether; the relic itself stays the centre
    anchor() { return O.crystalWorld; },                            // where tethers end and rings are born (world space)
    setQuality(q) {
      if (!built) return;
      O.mirror.visible = q < 2;                                   // the reflection is the first thing to go
      const irid = q < 1 ? 0.45 : 0; if (O.mats.pearl.iridescence !== irid) { O.mats.pearl.iridescence = irid; O.mats.pearl.needsUpdate = true; }
    },
    update(dt) {
      if (!built) return;
      dt = dt > 0 ? Math.min(dt, 0.1) : 0;
      M.t += dt; M.since += dt;
      const level = C.level, st = M.state, speaking = st === 'speaking';
      if (st === 'listening') { M.shellT = 0.90; M.ambT = 0.72; M.emisT = 0.55; M.innerT = 3.5; }
      else if (st === 'thinking') { M.shellT = 1.03; M.ambT = 0.85; M.emisT = 0.45 + 0.15 * Math.sin(M.t * 1.3); M.innerT = 4; }
      else { M.shellT = 1; M.ambT = 1; M.emisT = 0.40; M.innerT = 3; }
      const snap = M.since > 1.5;                                 // every pose has a deadline; past it, it settles at once
      M.shell = snap ? M.shellT : ease(M.shell, M.shellT, dt, 0.4);
      M.amb = snap ? M.ambT : ease(M.amb, M.ambT, dt, 0.5);
      M.emis = speaking ? 0.4 + 1.1 * level : ease(M.emis, M.emisT, dt, 0.35);
      M.inner = speaking ? 3 + 9 * level : ease(M.inner, M.innerT, dt, 0.35);
      if (M.turn) { M.turn.t += dt; M.shellYaw = M.turn.from + (M.turn.to - M.turn.from) * smooth(M.turn.t / M.turn.d); if (M.turn.t >= M.turn.d || M.turn.t > 3) { M.shellYaw = M.turn.to; M.turn = null; } }
      else if (st === 'thinking') M.shellYaw += dt * 0.08;
      M.relicYaw = 0.06 * Math.sin(M.t * TAU / 34);               // a few degrees of drift over half a minute, never accumulating
      const spinK = st === 'listening' ? 0.4 : 1;
      for (let i = 0; i < 3; i++) M.spin[i] += dt * RIBBONS[i].spin * spinK;
      M.breath = 1 + 0.012 * Math.sin(M.t * 0.9);
      // speaking peaks: one discrete flare per peak, never a strobe
      if (speaking && level > 0.7 && M.prevLevel <= 0.7 && M.t - M.lastPeak > 0.6) {
        M.lastPeak = M.t; M.flare = 1;
        const p = C.project(O.crystalWorld, O.ringOut); C.ring(p.x, p.y, RING_RGB, 700, 2, 260);
      }
      M.prevLevel = level;
      if (M.flare > 0) M.flare = Math.max(0, M.flare - dt / 0.35);
      // apply
      O.relic.rotation.y = M.relicYaw; O.shell.rotation.y = M.shellYaw; O.shell.scale.setScalar(M.shell); O.crystal.scale.setScalar(M.breath);
      for (let i = 0; i < 3; i++) { O.ribbons[i].quaternion.setFromAxisAngle(O.axes[i], M.spin[i]); }
      if (O.mirror.visible) {
        O.mirRelic.rotation.y = M.relicYaw; O.mirShell.rotation.y = M.shellYaw; O.mirShell.scale.copy(O.shell.scale); O.mirCrystal.scale.copy(O.crystal.scale);
        for (let i = 0; i < 3; i++) O.mirRibbons[i].quaternion.copy(O.ribbons[i].quaternion);
      }
      const L = O.lights;
      L.hemi.intensity = 0.28 * M.amb; L.key.intensity = 2.2 * (0.8 + 0.2 * M.amb); L.fill.intensity = 0.9 * M.amb; L.inner.intensity = M.inner;
      O.mats.crystal.emissiveIntensity = M.emis; O.mats.silver.emissiveIntensity = M.flare * 0.9;
    },
    resize(w, h) {
      if (!C || !built) return;
      const cam = C.camera, aspect = Math.max(0.2, w / Math.max(1, h));
      const d = aspect < 1 ? 6.4 + (1 - aspect) * 3.2 : 6.4;     // narrow screens: step back rather than squash
      cam.position.set(0, 1.45, d);
      cam.fov = clamp(2 * Math.atan(2.35 / (d * aspect)) * 180 / Math.PI, 30, 58);
      cam.aspect = aspect; cam.near = 0.1; cam.far = 80; cam.updateProjectionMatrix();
      cam.lookAt(O.look);
    },
    dispose() {
      if (!built) return;
      built = false;
      try { if (C && C.scene) { C.scene.remove(O.root); if (C.scene.environment === (O.env && O.env.texture)) C.scene.environment = null; } } catch (e) {}
      for (const g of O.geos) { try { g.dispose(); } catch (e) {} }
      for (const k in O.mats) { try { O.mats[k].dispose(); } catch (e) {} }
      if (O.env) { try { O.env.dispose(); } catch (e) {} }
      for (const k in O) delete O[k];
      C = null;
    },
    // The 2D fallback (no WebGL2, context lost, or Three.js unreachable): the
    // same object composed in flat shapes, still lit, still on its plinth.
    draw2d(ctx, W, H, c) {
      const s = Math.min(W, H) * 0.20, lv = c ? c.level : 0, glow = M.state === 'speaking' ? 0.35 + 0.65 * lv : (M.state === 'idle' ? 0.3 : 0.45);
      ctx.save(); ctx.translate(W / 2, H * 0.5);
      let g = ctx.createRadialGradient(0, s * 1.5, 0, 0, s * 1.5, s * 2.4); g.addColorStop(0, 'rgba(231,194,74,' + (0.20 * glow).toFixed(3) + ')'); g.addColorStop(1, 'rgba(231,194,74,0)');
      ctx.fillStyle = g; ctx.fillRect(-s * 3.2, s * 0.3, s * 6.4, s * 2.8);
      const steps = [[1.75, 1.42], [1.35, 1.32], [1.0, 1.2]];
      for (let i = 0; i < 3; i++) { const r = steps[i][0] * s * 0.7, y = s * steps[i][1]; ctx.fillStyle = i === 2 ? '#302941' : '#292337'; ctx.beginPath(); ctx.ellipse(0, y, r, r * 0.32, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(200,209,220,' + (i === 2 ? 0.75 : 0.28) + ')'; ctx.lineWidth = Math.max(1, s * 0.012); ctx.stroke(); }
      const loop = (a, b, rot, front) => { ctx.save(); ctx.rotate(rot); ctx.globalAlpha = front ? 1 : 0.72; ctx.strokeStyle = '#ECEAF2'; ctx.lineWidth = s * 0.10; ctx.beginPath(); ctx.ellipse(0, 0, a * s, b * s, 0, 0, TAU); ctx.stroke(); ctx.strokeStyle = 'rgba(200,209,220,0.9)'; ctx.lineWidth = s * 0.018; ctx.beginPath(); ctx.ellipse(0, 0, a * s + s * 0.05, b * s + s * 0.05, 0, 0, TAU); ctx.stroke(); ctx.restore(); };
      loop(1.22, 0.55, -0.7, false); loop(1.59, 0.42, 1.0, false);
      g = ctx.createRadialGradient(0, 0, 0, 0, 0, s * 1.6); g.addColorStop(0, 'rgba(231,194,74,' + (0.55 * glow).toFixed(3) + ')'); g.addColorStop(1, 'rgba(231,194,74,0)');
      ctx.fillStyle = g; ctx.fillRect(-s * 1.6, -s * 1.6, s * 3.2, s * 3.2);
      const gr = s * 0.42, gy = s * 0.13, top = -s * 1.05, bot = s * 0.95, px = [-gr * 0.87, 0, gr * 0.87], py = [-gy * 0.5, gy, -gy * 0.5];
      const tri = (ax, ay, bx, by, cx, cy, col) => { ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.lineTo(cx, cy); ctx.closePath(); ctx.fill(); };
      tri(0, top, px[0], py[0], px[1], py[1], '#F6DE86'); tri(0, top, px[1], py[1], px[2], py[2], '#E7C24A');
      tri(0, bot, px[0], py[0] + gy, px[1], py[1] + gy, '#D8AF5C'); tri(0, bot, px[1], py[1] + gy, px[2], py[2] + gy, '#B8902E');
      ctx.fillStyle = '#EED27A'; ctx.beginPath(); ctx.moveTo(px[0], py[0]); ctx.lineTo(px[1], py[1]); ctx.lineTo(px[2], py[2]); ctx.lineTo(px[2], py[2] + gy); ctx.lineTo(px[1], py[1] + gy); ctx.lineTo(px[0], py[0] + gy); ctx.closePath(); ctx.fill();
      loop(1.55, 0.7, 0.4, true);
      ctx.restore();
    },
    _geom: { RIBBONS, CRYSTAL, RELIC_Y, FLOOR_Y, pathAt }
  };
  FX.registerCore('loki', CORE);
})();
