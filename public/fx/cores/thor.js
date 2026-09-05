/* ASGARD FX — THOR ARC CORE. Strike Three, Phase 3.
   A hammer assembly — brushed-steel head with a cold-white band of light held
   in it, plum-wrapped haft with silver rings — hovering inside two wide
   interlocking pearl shells with silver edges, on a stepped plum plinth over
   the dark polished floor. Speaking peaks land as one discrete strike; the
   shells draw in while he thinks. Real geometry, authored motion, no
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

  // Two shells (same ribbon sweep as Loki's, wider, untwisted). Placed by a
  // numeric search so neither touches the hammer (closest 0.29 and 0.66), each
  // other (0.46) or the plinth.
  const SHELLS = [
    { a: 1.26, b: 0.95, rot: [0.28, 0.51, 0.94], off: [-0.09, 0.11, 0.03], w: 0.34, th: 0.05, twist: 0, seg: 112, spin: 0.026 },
    { a: 1.68, b: 1.35, rot: [-0.09, -0.56, 0.45], off: [0.03, 0.01, 0.04], w: 0.30, th: 0.05, twist: 0, seg: 128, spin: -0.019 }
  ];
  const RELIC_Y = 0.55, FLOOR_Y = -0.95, HEAD_Y = 0.15;
  const PLINTH = [[1.75, 0.10], [1.35, 0.12], [1.00, 0.16]];
  const COL = { core: 0xEAF8FF, rim: 0x66C7FF, pearl: 0xECEAF2, silver: 0xC8D1DC, steel: 0xB8C2CC, plum: 0x292337, void: 0x0B0A12, petrol: 0x285E6B, uv: 0x7965CF, floor: 0x14111D, leather: 0x1F1A2C };
  const RING_RGB = [102, 199, 255];

  function rotMat(r) {
    const cx = Math.cos(r[0]), sx = Math.sin(r[0]), cy = Math.cos(r[1]), sy = Math.sin(r[1]), cz = Math.cos(r[2]), sz = Math.sin(r[2]);
    return [cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx, sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx, -sy, cy * sx, cy * cx];
  }
  function mul(m, x, y, z, o, i) { o[i] = m[0] * x + m[1] * y + m[2] * z; o[i + 1] = m[3] * x + m[4] * y + m[5] * z; o[i + 2] = m[6] * x + m[7] * y + m[8] * z; }
  function pathAt(spec, t, out) {
    const m = spec._m || (spec._m = rotMat(spec.rot)), th = t * TAU, c = Math.cos(th), s = Math.sin(th);
    mul(m, spec.a * c, 0, spec.b * s, out, 0);
    mul(m, -spec.a * s, 0, spec.b * c, out, 3); const tl = Math.hypot(out[3], out[4], out[5]) || 1; out[3] /= tl; out[4] /= tl; out[5] /= tl;
    mul(m, 0, 1, 0, out, 6);
    return out;
  }
  function buildRibbon(THREE, spec) {
    const N = spec.seg, rings = N + 1, hw = spec.w / 2, ht = spec.th / 2;
    const pos = new Float32Array(4 * rings * 2 * 3), nor = new Float32Array(4 * rings * 2 * 3), idx = new Uint16Array(4 * N * 6);
    const f = new Float64Array(9), A = [0, 0, 0], B = [0, 0, 0], R = [0, 0, 0];
    const put = (face, slot, j, sa, sb, nx, ny, nz) => { const v = ((face * rings + j) * 2 + slot) * 3; pos[v] = f[0] + A[0] * sa * hw + B[0] * sb * ht; pos[v + 1] = f[1] + A[1] * sa * hw + B[1] * sb * ht; pos[v + 2] = f[2] + A[2] * sa * hw + B[2] * sb * ht; nor[v] = nx; nor[v + 1] = ny; nor[v + 2] = nz; };
    for (let j = 0; j < rings; j++) {
      const t = j / N; pathAt(spec, t, f);
      R[0] = f[4] * f[8] - f[5] * f[7]; R[1] = f[5] * f[6] - f[3] * f[8]; R[2] = f[3] * f[7] - f[4] * f[6];
      const phi = t * Math.PI * spec.twist, cp = Math.cos(phi), sp = Math.sin(phi);
      for (let k = 0; k < 3; k++) { A[k] = f[6 + k] * cp + R[k] * sp; B[k] = -f[6 + k] * sp + R[k] * cp; }
      put(0, 0, j, -1, 1, B[0], B[1], B[2]); put(0, 1, j, 1, 1, B[0], B[1], B[2]);
      put(1, 0, j, 1, -1, -B[0], -B[1], -B[2]); put(1, 1, j, -1, -1, -B[0], -B[1], -B[2]);
      put(2, 0, j, 1, 1, A[0], A[1], A[2]); put(2, 1, j, 1, -1, A[0], A[1], A[2]);
      put(3, 0, j, -1, -1, -A[0], -A[1], -A[2]); put(3, 1, j, -1, 1, -A[0], -A[1], -A[2]);
    }
    let q = 0;
    for (let face = 0; face < 4; face++) for (let j = 0; j < N; j++) { const a = (face * rings + j) * 2, b = a + 2; idx[q++] = a; idx[q++] = b + 1; idx[q++] = a + 1; idx[q++] = a; idx[q++] = b; idx[q++] = b + 1; }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.BufferAttribute(nor, 3)); g.setIndex(new THREE.BufferAttribute(idx, 1));
    g.addGroup(0, N * 12, 0); g.addGroup(N * 12, N * 12, 1);
    return g;
  }
  function makeEnv(THREE, renderer) {
    if (!THREE.PMREMGenerator) return null;
    const sc = new THREE.Scene(); sc.background = new THREE.Color(COL.void); const bits = [];
    const panel = (col, k, w, h, x, y, z, rx, ry) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide })); m.material.color.multiplyScalar(k); m.position.set(x, y, z); m.rotation.set(rx, ry, 0); sc.add(m); bits.push(m); };
    panel(COL.pearl, 5.0, 4, 2, 0, 5, 1, Math.PI / 2, 0); panel(COL.petrol, 2.2, 6, 3, -6, 1, 2, 0, Math.PI / 2); panel(COL.uv, 1.1, 8, 4, 0, 2, -7, 0, 0); panel(COL.rim, 1.2, 5, 1, 0, -1.5, 5, 0, Math.PI);
    const pm = new THREE.PMREMGenerator(renderer); const rt = pm.fromScene(sc, 0.05); pm.dispose();
    for (const m of bits) { m.geometry.dispose(); m.material.dispose(); }
    return rt;
  }

  const M = { state: 'idle', since: 0, shell: 1, shellT: 1, amb: 1, ambT: 1, emis: 0.5, emisT: 0.5, inner: 3, innerT: 3, drawIn: null, strike: 0, flare: 0, lastPeak: -9, prevLevel: 0, spin: [0, 0], yaw: 0, t: 0, sel: null };
  const O = {};
  let C = null, built = false;

  function build(THREE) {
    const mats = O.mats = {
      steel: new THREE.MeshStandardMaterial({ color: COL.steel, roughness: 0.38, metalness: 0.9, envMapIntensity: 1.0 }),
      cap: new THREE.MeshStandardMaterial({ color: COL.silver, roughness: 0.3, metalness: 0.92, envMapIntensity: 1.0 }),
      band: new THREE.MeshStandardMaterial({ color: COL.pearl, emissive: COL.core, emissiveIntensity: 0.5, roughness: 0.4, metalness: 0.1, envMapIntensity: 0.3 }),
      leather: new THREE.MeshStandardMaterial({ color: COL.leather, roughness: 0.75, metalness: 0.1, envMapIntensity: 0.4 }),
      pearl: new THREE.MeshPhysicalMaterial({ color: COL.pearl, roughness: 0.32, metalness: 0.08, clearcoat: 0.55, clearcoatRoughness: 0.25, iridescence: 0.35, iridescenceIOR: 1.35, iridescenceThicknessRange: [120, 480], side: THREE.DoubleSide, envMapIntensity: 0.9 }),
      silver: new THREE.MeshStandardMaterial({ color: COL.silver, roughness: 0.28, metalness: 0.92, emissive: COL.rim, emissiveIntensity: 0, side: THREE.DoubleSide, envMapIntensity: 1.0 }),
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
    // the relic: the hammer inside its shells
    const relic = O.relic = new THREE.Group(); relic.position.y = RELIC_Y; root.add(relic);
    const hammer = O.hammer = new THREE.Group(); relic.add(hammer);
    const add = (g, m, x, yy, z) => { geos.push(g); const mesh = new THREE.Mesh(g, m); mesh.position.set(x, yy, z); hammer.add(mesh); return mesh; };
    add(new THREE.BoxGeometry(1.24, 0.6, 0.6), mats.steel, 0, HEAD_Y, 0);                       // head
    add(new THREE.BoxGeometry(0.08, 0.66, 0.66), mats.cap, 0.62, HEAD_Y, 0);                    // striking faces
    add(new THREE.BoxGeometry(0.08, 0.66, 0.66), mats.cap, -0.62, HEAD_Y, 0);
    O.band = add(new THREE.BoxGeometry(0.42, 0.64, 0.64), mats.band, 0, HEAD_Y, 0);            // the light held in the head
    add(new THREE.CylinderGeometry(0.075, 0.09, 1.1, 12), mats.leather, 0, HEAD_Y - 0.85, 0);   // haft: from the head down to -0.95
    add(new THREE.CylinderGeometry(0.1, 0.1, 0.06, 12), mats.cap, 0, HEAD_Y - 0.33, 0);         // collar
    add(new THREE.CylinderGeometry(0.095, 0.095, 0.05, 12), mats.cap, 0, HEAD_Y - 0.95, 0);     // ring
    add(new THREE.CylinderGeometry(0.12, 0.1, 0.1, 12), mats.cap, 0, HEAD_Y - 1.13, 0);         // pommel (bottom at -1.03 local: above the plinth)
    const shell = O.shell = new THREE.Group(); relic.add(shell);
    O.ribbons = []; O.axes = [];
    for (const spec of SHELLS) {
      const g = buildRibbon(THREE, spec); geos.push(g);
      const m = new THREE.Mesh(g, [mats.pearl, mats.silver]); m.position.set(spec.off[0], spec.off[1], spec.off[2]); shell.add(m); O.ribbons.push(m);
      const mm = rotMat(spec.rot); O.axes.push(new THREE.Vector3(mm[1], mm[4], mm[7]).normalize());
    }
    const mirror = O.mirror = new THREE.Group(); mirror.scale.y = -1; mirror.position.y = 2 * FLOOR_Y; root.add(mirror);
    O.mirRelic = relic.clone(); mirror.add(O.mirRelic);
    O.mirHammer = O.mirRelic.children[0]; O.mirShell = O.mirRelic.children[1]; O.mirRibbons = O.mirShell.children;
    const L = O.lights = {
      key: new THREE.DirectionalLight(COL.pearl, 2.2), fill: new THREE.DirectionalLight(COL.petrol, 0.8), rim: new THREE.DirectionalLight(COL.rim, 1.8),
      hemi: new THREE.HemisphereLight(COL.uv, COL.void, 0.28), inner: new THREE.PointLight(COL.core, 3, 6, 2)
    };
    L.key.position.set(2.5, 4, 3); L.fill.position.set(-3, 1, 2); L.rim.position.set(-1.5, 2.5, -3.5); L.inner.position.set(0, RELIC_Y + HEAD_Y, 0);
    for (const k in L) root.add(L[k]);
    O.look = new THREE.Vector3(0, RELIC_Y - 0.1, 0); O.crystalWorld = new THREE.Vector3(0, RELIC_Y + HEAD_Y, 0); O.ringOut = { x: 0, y: 0 };
    return root;
  }

  const CORE = {
    init(ctx) {
      C = ctx; const THREE = ctx.THREE;
      ctx.scene.add(build(THREE));
      try { O.env = makeEnv(THREE, ctx.renderer); if (O.env) ctx.scene.environment = O.env.texture; } catch (e) { console.warn('[thor core] environment map unavailable, lights only:', e && e.message); O.env = null; }
      built = true;
      this.resize(ctx.w, ctx.h); this.setQuality(ctx.quality);
    },
    setState(s, level) {
      if (s !== M.state) { M.since = 0; M.drawIn = s === 'thinking' ? { t: 0, d: 2.0, from: M.shell } : null; }
      M.state = s; if (typeof level === 'number' && isFinite(level)) M.prevLevel = level;
    },
    select(id) { M.sel = id || null; },
    anchor() { return O.crystalWorld; },
    setQuality(q) {
      if (!built) return;
      O.mirror.visible = q < 2;
      const irid = q < 1 ? 0.35 : 0; if (O.mats.pearl.iridescence !== irid) { O.mats.pearl.iridescence = irid; O.mats.pearl.needsUpdate = true; }
    },
    update(dt) {
      if (!built) return;
      dt = dt > 0 ? Math.min(dt, 0.1) : 0; M.t += dt; M.since += dt;
      const level = C.level, st = M.state, speaking = st === 'speaking';
      if (st === 'listening') { M.shellT = 0.92; M.ambT = 0.72; M.emisT = 0.65; M.innerT = 3.5; }
      else if (st === 'thinking') { M.shellT = 0.80; M.ambT = 0.85; M.emisT = 0.55 + 0.15 * Math.sin(M.t * 1.2); M.innerT = 4; }
      else { M.shellT = 1; M.ambT = 1; M.emisT = 0.5; M.innerT = 3; }
      const snap = M.since > 1.5;
      if (M.drawIn) { const d = M.drawIn; d.t += dt; M.shell = d.from + (0.80 - d.from) * smooth(d.t / d.d); if (d.t >= d.d || d.t > 3) { M.shell = 0.80; M.drawIn = null; } }   // the shells draw in once, and hold
      else M.shell = snap ? M.shellT : ease(M.shell, M.shellT, dt, 0.45);
      M.amb = snap ? M.ambT : ease(M.amb, M.ambT, dt, 0.5);
      M.emis = speaking ? 0.5 + 1.2 * level : ease(M.emis, M.emisT, dt, 0.35);
      M.inner = speaking ? 3 + 9 * level : ease(M.inner, M.innerT, dt, 0.35);
      M.yaw = 0.06 * Math.sin(M.t * TAU / 36);
      const spinK = st === 'listening' ? 0.4 : 1;
      for (let i = 0; i < 2; i++) M.spin[i] += dt * SHELLS[i].spin * spinK;
      // speaking peaks: one discrete strike — the hammer drops and rebounds, the edges flash, one ring
      if (speaking && level > 0.7 && M.prevLevel <= 0.7 && M.t - M.lastPeak > 0.6) {
        M.lastPeak = M.t; M.strike = 1; M.flare = 1;
        const p = C.project(O.crystalWorld, O.ringOut); C.ring(p.x, p.y, RING_RGB, 760, 2.5, 280);
        C.flash(0.1, RING_RGB, 0.18);
      }
      M.prevLevel = level;
      if (M.strike > 0) M.strike = Math.max(0, M.strike - dt / 0.4);
      if (M.flare > 0) M.flare = Math.max(0, M.flare - dt / 0.35);
      // strike profile: a fast drop, a slower rebound
      const k = 1 - M.strike, drop = k < 0.3 ? (k / 0.3) : (1 - (k - 0.3) / 0.7);
      const hy = 0.015 * Math.sin(M.t * 0.9) - 0.14 * (M.strike > 0 ? drop : 0);
      O.relic.rotation.y = M.yaw; O.hammer.position.y = hy; O.shell.scale.setScalar(M.shell);
      for (let i = 0; i < 2; i++) O.ribbons[i].quaternion.setFromAxisAngle(O.axes[i], M.spin[i]);
      if (O.mirror.visible) { O.mirRelic.rotation.y = M.yaw; O.mirHammer.position.y = hy; O.mirShell.scale.copy(O.shell.scale); for (let i = 0; i < 2; i++) O.mirRibbons[i].quaternion.copy(O.ribbons[i].quaternion); }
      const L = O.lights;
      L.hemi.intensity = 0.28 * M.amb; L.key.intensity = 2.2 * (0.8 + 0.2 * M.amb); L.fill.intensity = 0.8 * M.amb; L.inner.intensity = M.inner + M.flare * 10;
      O.mats.band.emissiveIntensity = M.emis + M.flare * 1.5; O.mats.silver.emissiveIntensity = M.flare * 0.9;
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
      let g = ctx.createRadialGradient(0, s * 1.5, 0, 0, s * 1.5, s * 2.4); g.addColorStop(0, 'rgba(102,199,255,' + (0.18 * glow).toFixed(3) + ')'); g.addColorStop(1, 'rgba(102,199,255,0)');
      ctx.fillStyle = g; ctx.fillRect(-s * 3.2, s * 0.3, s * 6.4, s * 2.8);
      const steps = [[1.75, 1.42], [1.35, 1.32], [1.0, 1.2]];
      for (let i = 0; i < 3; i++) { const r = steps[i][0] * s * 0.7, y = s * steps[i][1]; ctx.fillStyle = i === 2 ? '#302941' : '#292337'; ctx.beginPath(); ctx.ellipse(0, y, r, r * 0.32, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = 'rgba(200,209,220,' + (i === 2 ? 0.75 : 0.28) + ')'; ctx.lineWidth = Math.max(1, s * 0.012); ctx.stroke(); }
      const loop = (a, b, rot, front) => { ctx.save(); ctx.rotate(rot); ctx.globalAlpha = front ? 1 : 0.72; ctx.strokeStyle = '#ECEAF2'; ctx.lineWidth = s * 0.13; ctx.beginPath(); ctx.ellipse(0, 0, a * s, b * s, 0, 0, TAU); ctx.stroke(); ctx.strokeStyle = 'rgba(200,209,220,0.9)'; ctx.lineWidth = s * 0.02; ctx.beginPath(); ctx.ellipse(0, 0, a * s + s * 0.07, b * s + s * 0.07, 0, 0, TAU); ctx.stroke(); ctx.restore(); };
      loop(1.68, 0.6, -0.5, false);
      g = ctx.createRadialGradient(0, -s * 0.15, 0, 0, -s * 0.15, s * 1.2); g.addColorStop(0, 'rgba(234,248,255,' + (0.5 * glow).toFixed(3) + ')'); g.addColorStop(1, 'rgba(234,248,255,0)'); ctx.fillStyle = g; ctx.fillRect(-s * 1.4, -s * 1.4, s * 2.8, s * 2.8);
      ctx.fillStyle = '#1F1A2C'; ctx.fillRect(-s * 0.08, -s * 0.15, s * 0.16, s * 1.1);                      // haft
      ctx.fillStyle = '#C8D1DC'; ctx.fillRect(-s * 0.11, s * 0.85, s * 0.22, s * 0.1);                     // pommel
      ctx.fillStyle = '#B8C2CC'; ctx.fillRect(-s * 0.62, -s * 0.45, s * 1.24, s * 0.6);                    // head
      ctx.fillStyle = '#EAF8FF'; ctx.globalAlpha = 0.6 + 0.4 * glow; ctx.fillRect(-s * 0.21, -s * 0.47, s * 0.42, s * 0.64); ctx.globalAlpha = 1;   // the band of light
      ctx.fillStyle = '#C8D1DC'; ctx.fillRect(-s * 0.66, -s * 0.48, s * 0.08, s * 0.66); ctx.fillRect(s * 0.58, -s * 0.48, s * 0.08, s * 0.66);
      loop(1.26, 0.7, 0.9, true);
      ctx.restore();
    }
  };
  FX.registerCore('thor', CORE);
})();
