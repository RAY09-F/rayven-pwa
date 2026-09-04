/* ASGARD FX — ODIN: a throne hall at golden hour. Registers itself with the engine. */
(function () {
  'use strict';
  if (!window.AsgardFX || !window.AsgardFX.registerRealm) return;
  const GOLD = [255, 199, 64], NAVY = [12, 20, 48], BONE = [246, 244, 236], AMBER = [255, 160, 40];
  let E, S;
  const O = { sunrise: 1, flare: 0, iris: 0, birdsNext: 12, birds: [], wakeT: -1 };
  const SUN = { x: 0.8, y: 0.3 };

  const FRAG = [
    'vec4 realm(vec2 uv){',
    ' float asp=u_res.x/max(1.,u_res.y); float t=u_time; vec2 cp=vec2(uv.x*asp,uv.y);',
    ' float rise=clamp(u_a,0.,1.); float flare=u_b;',
    ' vec2 sun=vec2(0.8*asp, mix(-0.15,0.3,rise));',
    ' float d=distance(cp,sun);',
    ' vec3 col=mix(vec3(0.03,0.05,0.12),vec3(0.01,0.02,0.05),uv.y);',            // deep navy
    ' float hz=smoothstep(0.35,0.0,uv.y); col+=vec3(0.45,0.28,0.08)*hz*hz*0.35*rise;',   // horizon glow
    ' float ang=atan(cp.y-sun.y,cp.x-sun.x);',
    ' float rays=0.55+0.45*sin(ang*9.+t*0.15)*sin(ang*17.-t*0.1);',
    ' float beam=exp(-d*1.6)*(0.35+0.65*rays);',
    ' col+=vec3(1.0,0.72,0.22)*beam*(0.55+flare*0.9)*rise;',
    ' col+=vec3(1.0,0.85,0.5)*exp(-d*14.0)*(1.2+flare*2.0)*rise;',                // the disc
    ' float slant=fbm3(vec2(cp.x*0.9+cp.y*1.3+t*0.01, cp.y*0.5-t*0.004));',
    ' col+=vec3(0.9,0.65,0.25)*slant*exp(-d*1.1)*0.22*rise;',                      // dust haze in the slanted light
    ' float wk=sin(clamp(u_wake,0.,1.)*3.1416); col+=vec3(1.0,0.8,0.4)*wk*wk*0.25;',
    ' col*=smoothstep(0.0,0.55,1.0-length(uv-0.5)*0.85);',
    ' return vec4(col,1.0);}'
  ].join('\n');

  function spawnDust(n) { for (let i = 0; i < n; i++) E.P.spawn(E.rand(0, E.w), E.rand(0, E.h), E.rand(-6, 6), E.rand(-4, 4), E.rand(10, 22), E.rand(0.8, 2.2), 1, Math.random() * 6.2832, 0.3 + Math.random() * 0.7); }
  function flock() {
    const n = 3 + ((Math.random() * 5) | 0), dir = Math.random() < 0.5 ? 1 : -1, y = E.h * (0.12 + Math.random() * 0.3), sp = 40 + Math.random() * 40;
    for (let i = 0; i < n; i++) O.birds.push({ x: dir > 0 ? -60 - i * 26 : E.w + 60 + i * 26, y: y + (i % 2 ? 1 : -1) * i * 9, dir, sp: sp * (0.9 + Math.random() * 0.2), ph: Math.random() * 6.28, s: 0.5 + Math.random() * 0.5 });
  }
  const R = {
    id: 'odin', palette: [GOLD, NAVY, BONE], frag: FRAG,
    init(e) { E = e; S = e.S; },
    resize() {},
    enter() { O.birds.length = 0; O.iris = 0; O.flare = 0; O.wakeT = -1; O.sunrise = 1; if (E.animated) spawnDust(220 / E.stride); },
    uniforms() { return { a: O.sunrise, b: O.flare, c: O.iris }; },
    update(dt) {
      if (!E.animated) return;
      const P = E.P, t = S.t;
      O.flare = Math.max(0, O.flare - dt * 2.2);
      O.iris = E.lerp(O.iris, S.state === 'thinking' ? 1 : 0, Math.min(1, dt * (S.state === 'thinking' ? 0.35 : 3)));
      if (O.wakeT >= 0) { O.wakeT += dt; O.sunrise = Math.min(1, O.wakeT / 1.2); if (O.wakeT > 1.2 && O.wakeT - dt <= 1.2) { E.flash(0.35, GOLD, 0.6); E.ring(E.cx, E.cy, GOLD, 700, 3); } if (O.wakeT > 2.5) O.wakeT = -1; }
      // birds every 20–40 s
      O.birdsNext -= dt; if (O.birdsNext <= 0) { flock(); O.birdsNext = 20 + Math.random() * 20; }
      for (let i = O.birds.length - 1; i >= 0; i--) { const b = O.birds[i]; b.x += b.dir * b.sp * dt; b.y += Math.sin(t * 0.6 + b.ph) * 4 * dt; if (b.x < -120 || b.x > E.w + 120) O.birds.splice(i, 1); }
      // dust: slow, slanted, drifting inward while listening, catching the light on wake
      let alive = 0;
      const inward = S.listen;
      for (let i = 0; i < P.n; i++) {
        if (!P.alive[i]) continue;
        if (P.kind[i] === 1) {
          alive++;
          P.a[i] += dt * 0.7;
          P.vx[i] = 6 * Math.sin(P.a[i]) + 4 - inward * (P.x[i] - E.cx) * 0.06;
          P.vy[i] = -3 + 4 * Math.cos(P.a[i] * 0.7) - inward * (P.y[i] - E.cy) * 0.06;
          if (P.x[i] > E.w + 10) P.x[i] = -10; if (P.x[i] < -10) P.x[i] = E.w + 10; if (P.y[i] < -10) P.y[i] = E.h + 10; if (P.y[i] > E.h + 10) P.y[i] = -10;
          if (P.life[i] < 1) P.life[i] = 10;  // dust lives for the whole visit
        }
      }
      if (alive < 220 / E.stride) spawnDust(4);
      P.step(dt);
    },
    draw(ctx) {
      if (!E.animated) return;
      const P = E.P, st = E.stride, t = S.t, sx = SUN.x * E.w, sy = (1 - (O.sunrise * 0.45 - 0.15)) * E.h;
      // gold dust, brighter near the slanted beam
      for (let i = 0; i < P.n; i += st) {
        if (!P.alive[i]) continue; const x = P.x[i], y = P.y[i]; if (!E.onScreen(x, y)) continue;
        const s = P.size[i] * E.strideSize;
        if (P.kind[i] === 1) {
          const dd = Math.hypot(x - sx, y - sy) / Math.max(E.w, E.h);
          const lit = (0.25 + 0.75 * Math.max(0, 1 - dd * 1.4)) * P.b[i] * (0.6 + 0.4 * Math.sin(t * 1.3 + P.a[i] * 3)) * (0.35 + 0.65 * O.sunrise);
          ctx.fillStyle = E.rgba(GOLD, lit * 0.9); ctx.beginPath(); ctx.arc(x, y, s, 0, 6.2832); ctx.fill();
        } else { const lf = P.life[i] / P.max[i]; ctx.fillStyle = E.rgba(BONE, lf * 0.8); ctx.fillRect(x - s / 2, y - s / 2, s, s); }
      }
      // birds, far, silhouettes
      ctx.strokeStyle = 'rgba(4,6,14,0.75)'; ctx.lineWidth = 1.6; ctx.lineCap = 'round';
      for (const b of O.birds) { const f = Math.sin(t * 7 + b.ph) * 5 * b.s, w = 11 * b.s; ctx.beginPath(); ctx.moveTo(b.x - w, b.y + f); ctx.quadraticCurveTo(b.x - w * 0.4, b.y - 2 * b.s, b.x, b.y); ctx.quadraticCurveTo(b.x + w * 0.4, b.y - 2 * b.s, b.x + w, b.y + f); ctx.stroke(); }
      // the iris: one slow ring closing toward the centre while thinking — abstract, never a face
      if (O.iris > 0.01) { const r = Math.max(0.1, Math.min(E.w, E.h) * (0.48 - 0.30 * O.iris)); ctx.strokeStyle = E.rgba(GOLD, 0.35 + 0.4 * O.iris); ctx.lineWidth = 1.5 + 3 * O.iris; ctx.beginPath(); ctx.arc(E.cx, E.cy, r, 0, 6.2832); ctx.stroke(); ctx.strokeStyle = E.rgba(BONE, 0.25 * O.iris); ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(E.cx, E.cy, r * 0.93, 0.3 + t * 0.2, 2.2 + t * 0.2); ctx.stroke(); }
      // the sun flaring on the loudest peaks (bloom-off fallback draws it here)
      if (!E.bloom && O.flare > 0.02) { const g = E.radial(ctx, sx, sy, 0, 260 * O.flare); g.addColorStop(0, E.rgba(BONE, 0.5 * O.flare)); g.addColorStop(0.3, E.rgba(GOLD, 0.25 * O.flare)); g.addColorStop(1, E.rgba(AMBER, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(sx, sy, 260 * O.flare + 0.1, 0, 6.2832); ctx.fill(); }
    },
    drawGlow(g) {
      const s = E.gs, sx = SUN.x * E.w * s, sy = (1 - (O.sunrise * 0.45 - 0.15)) * E.h * s;
      if (O.flare > 0.02) { const gr = E.radial(g, sx, sy, 0, 300 * s * O.flare); gr.addColorStop(0, E.rgba(BONE, 0.7 * O.flare)); gr.addColorStop(0.35, E.rgba(GOLD, 0.35 * O.flare)); gr.addColorStop(1, E.rgba(AMBER, 0)); g.fillStyle = gr; g.beginPath(); g.arc(sx, sy, 300 * s * O.flare + 0.1, 0, 6.2832); g.fill(); }
      if (O.iris > 0.01) { const r = Math.max(0.1, Math.min(E.w, E.h) * (0.48 - 0.30 * O.iris) * s); g.strokeStyle = E.rgba(GOLD, 0.5 * O.iris); g.lineWidth = 6; g.beginPath(); g.arc(E.cx * s, E.cy * s, r, 0, 6.2832); g.stroke(); }
      g.fillStyle = E.rgba(GOLD, 0.25); const P = E.P;
      for (let i = 0; i < P.n; i += E.stride * 3) { if (!P.alive[i] || P.b[i] < 0.75) continue; const x = P.x[i] * s, y = P.y[i] * s; if (x > -4 && x < g.canvas.width + 4 && y > -4 && y < g.canvas.height + 4) g.fillRect(x - 1.5, y - 1.5, 3, 3); }
    },
    back2d(ctx, e, W, H) {
      const grad = ctx.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, '#080d1f'); grad.addColorStop(1, '#03050c'); ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
      const sx = SUN.x * W, sy = (1 - (O.sunrise * 0.45 - 0.15)) * H;
      const g = E.radial(ctx, sx, sy, 0, W * 0.7); g.addColorStop(0, E.rgba(BONE, 0.9 * O.sunrise)); g.addColorStop(0.06, E.rgba(GOLD, 0.6 * O.sunrise)); g.addColorStop(0.35, E.rgba(AMBER, 0.12 * O.sunrise + O.flare * 0.2)); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      const hz = ctx.createLinearGradient(0, H * 0.7, 0, H); hz.addColorStop(0, 'rgba(255,160,40,0)'); hz.addColorStop(1, E.rgba(AMBER, 0.18 * O.sunrise)); ctx.fillStyle = hz; ctx.fillRect(0, H * 0.7, W, H * 0.3);
    },
    wake() { O.wakeT = 0; O.sunrise = 0; },
    onPeak(level) { O.flare = Math.max(O.flare, E.clamp((level - 0.5) * 2.2, 0.3, 1)); },
    onPhrase() { E.ring(E.cx, E.cy, GOLD, 520, 2.5, Math.max(E.w, E.h) * 0.7); },
    pulse(kind) { if (kind === 'receive') E.ring(E.cx, E.cy, BONE, 800, 2); if (kind === 'send') O.flare = Math.max(O.flare, 0.35); },
    trail(x, y, vx, vy) { E.P.spawn(x, y, vx * 0.04 + E.rand(-12, 12), vy * 0.04 + E.rand(-25, -5), E.rand(0.6, 1.4), E.rand(1, 2.2), 2); }
  };
  window.AsgardFX.registerRealm('odin', R);
})();
