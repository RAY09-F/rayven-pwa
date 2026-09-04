/* ASGARD FX — THOR: a storm supercell. Registers itself with the engine. */
(function () {
  'use strict';
  if (!window.AsgardFX || !window.AsgardFX.registerRealm) return;
  const BLUE = [70, 150, 255], WHITE = [255, 255, 255], GOLD = [255, 199, 64], PALE = [170, 205, 255];
  let E, S;
  const T = { sheet: 0, sheetNext: 8, charge: 0, flash: 0, bolts: [], arrivals: [], wakeT: -1, wakePhase: 0, crawl: [], thunderQueue: [] };
  const cloud = document.createElement('canvas'); let cloudReady = false;

  const FRAG = [
    'vec4 realm(vec2 uv){',
    ' vec2 p=uv; float asp=u_res.x/max(1.,u_res.y);',
    ' p+=(vec2(0.5)-p)*0.10*u_listen;',                                  // clouds lean toward the centre
    ' vec2 cp=vec2(p.x*asp,p.y);',
    ' float t=u_time;',
    ' float c1=fbm(cp*2.2+vec2(t*0.020,t*0.006));',
    ' float c2=fbm(cp*3.6-vec2(t*0.052,-t*0.011)+1.7);',
    ' float cl=smoothstep(0.35,0.8,c1*0.65+c2*0.5);',
    ' vec3 sky=mix(vec3(0.010,0.016,0.040),vec3(0.05,0.09,0.20),uv.y*0.6);',
    ' vec2 lp=vec2(0.5+0.18*sin(t*0.13),0.72+0.06*cos(t*0.17));',
    ' float inner=exp(-distance(vec2(p.x*asp,p.y),vec2(lp.x*asp,lp.y))*2.4);',   // lit from inside
    ' float sheet=u_a; float charge=u_b; float strike=u_c;',
    ' float lit=cl*(0.28+inner*0.55+sheet*0.9+strike*1.4)+charge*exp(-distance(vec2(p.x*asp,p.y),vec2(0.5*asp,0.86))*3.0)*1.6*(0.7+0.3*sin(t*9.));',
    ' vec3 col=sky+vec3(0.32,0.45,0.75)*lit+vec3(0.9,0.95,1.0)*max(0.,lit-0.6)*0.8;',
    ' col+=vec3(0.55,0.68,1.0)*sheet*0.28+vec3(1.0)*strike*0.45;',
    ' float wk=sin(clamp(u_wake,0.,1.)*3.1416); col+=vec3(0.7,0.8,1.0)*wk*wk*0.9;',
    // rain, three depth layers with parallax
    ' float rs=1.0-0.15*u_listen-0.35*u_think; float rain=0.;',
    ' for(int L=0;L<3;L++){ float fl=float(L); float cols=52.+fl*34.; float spd=(2.4-fl*0.55)*rs;',
    '  float xoff=(uv.x-0.5)*(0.06+fl*0.05)*sin(t*0.3); vec2 rp=vec2((uv.x+xoff)*cols+fl*7.3, uv.y*(3.+fl)+t*spd);',
    '  float col_=hash(vec2(floor(rp.x),fl)); rp.y+=col_*9.;',
    '  float f=fract(rp.y); float on=step(0.90+fl*0.02,hash(vec2(floor(rp.x),floor(rp.y))));',
    '  float streak=on*smoothstep(0.0,0.12,f)*smoothstep(0.55,0.12,f)*(1.-smoothstep(0.0,0.22,abs(fract(rp.x)-0.5)));',
    '  rain+=streak*(0.22-fl*0.05)*(1.+sheet+strike*1.5); }',
    ' col+=vec3(0.55,0.7,1.0)*rain;',
    ' col*=smoothstep(0.0,0.45,1.0-length(uv-0.5)*0.9);',                 // vignette
    ' return vec4(col,1.0);}'
  ].join('\n');

  function prerenderCloud() {
    cloud.width = 256; cloud.height = 160; const c = cloud.getContext('2d');
    c.clearRect(0, 0, 256, 160);
    for (let i = 0; i < 40; i++) {
      const x = 30 + Math.random() * 196, y = 40 + Math.random() * 80, r = 20 + Math.random() * 46;
      const g = E.radial(c, x, y, 0, r); g.addColorStop(0, 'rgba(90,130,200,0.16)'); g.addColorStop(1, 'rgba(90,130,200,0)');
      c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2);
    }
    cloudReady = true;
  }
  function makeBolt(x0, y0, x1, y1, jag, forks) {
    const pts = [x0, y0]; let x = x0, y = y0;
    const dx = x1 - x0, dy = y1 - y0, len = Math.hypot(dx, dy) || 1, n = Math.max(6, Math.min(26, (len / 22) | 0));
    const nx = -dy / len, ny = dx / len;
    for (let i = 1; i <= n; i++) {
      const k = i / n, off = (Math.random() - 0.5) * jag * len * (1 - k * 0.5) * 0.18;
      x = x0 + dx * k + nx * off; y = y0 + dy * k + ny * off; pts.push(x, y);
    }
    const bolt = { pts, forks: [], life: 0.22 + Math.random() * 0.12, max: 0, seed: Math.random() * 1000 };
    bolt.max = bolt.life;
    for (let f = 0; f < forks; f++) {
      const i = 2 + ((Math.random() * (n - 3)) | 0), fx = pts[i * 2], fy = pts[i * 2 + 1];
      const ang = Math.atan2(dy, dx) + (Math.random() - 0.5) * 1.6, fl = len * (0.18 + Math.random() * 0.3);
      bolt.forks.push(makeBolt(fx, fy, fx + Math.cos(ang) * fl, fy + Math.sin(ang) * fl, jag * 1.3, forks > 1 && Math.random() < 0.4 ? 1 : 0));
    }
    return bolt;
  }
  function strike(strength, fromCentre) {
    if (!E.animated) { E.flash(strength * 0.5, PALE, 0.2); return; }
    if (T.bolts.length > 7) T.bolts.shift();
    const w = E.w, h = E.h;
    let x0, y0, x1, y1;
    if (fromCentre) { const a = Math.random() * 6.2832, r = Math.max(w, h) * 0.75; x0 = E.cx; y0 = E.cy; x1 = E.cx + Math.cos(a) * r; y1 = E.cy + Math.sin(a) * r; }
    else { x0 = E.rand(w * 0.1, w * 0.9); y0 = -10; const ang = Math.random() * 6.2832, rr = 150 + Math.random() * 120; x1 = E.cx + Math.cos(ang) * rr; y1 = E.cy + Math.sin(ang) * rr * 0.6; }
    const b = makeBolt(x0, y0, x1, y1, 0.9 + strength, 2 + ((Math.random() * 3) | 0));
    b.strength = strength; T.bolts.push(b);
    T.flash = Math.max(T.flash, 0.4 + strength * 0.6);
    E.flash(0.25 + strength * 0.5, PALE, 0.18 + strength * 0.1);
    const dist = Math.hypot(x1 - E.cx, y1 - E.cy) / Math.max(w, h);
    E.sfx.thunder(0.05 + dist * 0.5 + Math.random() * 0.15, 0.18 + strength * 0.4);
    for (let i = 0; i < 14; i++) E.P.spawn(x1, y1, E.rand(-260, 260), E.rand(-260, 120), E.rand(0.3, 0.8), E.rand(1, 2.5), 2);
  }
  function drawBoltPass(ctx, b, width, color, alpha, jitter) {
    const p = b.pts; ctx.strokeStyle = E.rgba(color, alpha); ctx.lineWidth = width; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < p.length; i += 2) { const jx = jitter ? (Math.random() - 0.5) * jitter : 0, jy = jitter ? (Math.random() - 0.5) * jitter : 0; if (i === 0) ctx.moveTo(p[i] + jx, p[i + 1] + jy); else ctx.lineTo(p[i] + jx, p[i + 1] + jy); }
    ctx.stroke();
    for (const f of b.forks) drawBoltPass(ctx, f, width * 0.6, color, alpha * 0.8, jitter);
  }

  const R = {
    id: 'thor', palette: [BLUE, WHITE, GOLD], frag: FRAG,
    init(e) { E = e; S = e.S; },
    resize() { if (E) prerenderCloud(); },
    enter() { T.bolts.length = 0; T.arrivals.length = 0; T.flash = 0; T.charge = 0; T.wakeT = -1; },
    uniforms() { return { a: T.sheet, b: T.charge, c: T.flash }; },
    update(dt) {
      if (!E.animated) return;
      // distant sheet lightning behind the clouds, every 6–14 s, no sound
      T.sheetNext -= dt;
      if (T.sheetNext <= 0) { T.sheet = 0.6 + Math.random() * 0.4; T.sheetNext = 6 + Math.random() * 8; }
      T.sheet = Math.max(0, T.sheet - dt * (T.sheet > 0.5 ? 3.2 : 1.6));
      if (T.sheet > 0.5 && Math.random() < 0.15) T.sheet *= 0.75;      // flicker
      // one slow bolt builds behind the cloud layer while thinking
      T.charge = E.lerp(T.charge, S.state === 'thinking' ? 1 : 0, Math.min(1, dt * (S.state === 'thinking' ? 0.9 : 4)));
      T.flash = Math.max(0, T.flash - dt * 4.5);
      // static charge crawling around the reactor ring while listening
      if (S.state === 'listening' && Math.random() < dt * 9) {
        const a = Math.random() * 6.2832, r = 118 + Math.random() * 60;
        T.crawl.push({ a, r, life: 0.12 + Math.random() * 0.1, len: 0.25 + Math.random() * 0.5 });
        if (T.crawl.length > 12) T.crawl.shift();
      }
      for (let i = T.crawl.length - 1; i >= 0; i--) { T.crawl[i].life -= dt; if (T.crawl[i].life <= 0) T.crawl.splice(i, 1); }
      for (let i = T.bolts.length - 1; i >= 0; i--) { T.bolts[i].life -= dt; if (T.bolts[i].life <= 0) T.bolts.splice(i, 1); }
      // wake choreography: the sky ignites, twelve arrival points, then 26 bolts outward, flash, ring
      if (T.wakeT >= 0) {
        T.wakeT += dt;
        if (T.wakePhase === 0 && T.wakeT > 0.05) { T.wakePhase = 1; E.flash(0.9, PALE, 0.5); T.flash = 1; }
        if (T.wakePhase === 1 && T.wakeT > 0.35) { T.wakePhase = 2; for (let i = 0; i < 12; i++) { const a = i / 12 * 6.2832 + Math.random() * 0.3, r = Math.min(E.w, E.h) * (0.3 + Math.random() * 0.15); T.arrivals.push({ x: E.cx + Math.cos(a) * r, y: E.cy + Math.sin(a) * r, t: -i * 0.04 }); } }
        if (T.wakePhase === 2 && T.wakeT > 1.0) { T.wakePhase = 3; T.boltsLeft = 26; T.boltTimer = 0; }
        if (T.wakePhase === 3) { T.boltTimer -= dt; while (T.boltsLeft > 0 && T.boltTimer <= 0) { T.boltsLeft--; T.boltTimer += 0.028; const a = Math.random() * 6.2832, r = Math.max(E.w, E.h) * (0.5 + Math.random() * 0.4); if (T.bolts.length > 7) T.bolts.shift(); const b = makeBolt(E.cx, E.cy, E.cx + Math.cos(a) * r, E.cy + Math.sin(a) * r, 1.1, 2); b.strength = 0.6; T.bolts.push(b); } if (T.boltsLeft === 0) { T.wakePhase = 4; E.flash(1, WHITE, 0.4); T.flash = 1; E.ring(E.cx, E.cy, PALE, 1400, 4); E.ring(E.cx, E.cy, GOLD, 900, 2); } }
        if (T.wakeT > 2.4) { T.wakeT = -1; T.arrivals.length = 0; }
      }
      for (const a of T.arrivals) a.t += dt;
      const P = E.P;
      for (let i = 0; i < P.n; i++) if (P.alive[i] && P.kind[i] === 2) P.vy[i] += 700 * dt;
      P.step(dt);
    },
    draw(ctx) {
      if (!E.animated) return;
      // arrival points
      for (const a of T.arrivals) { if (a.t < 0) continue; const k = Math.min(1, a.t * 3); const g = E.radial(ctx, a.x, a.y, 0, 18 * k); g.addColorStop(0, E.rgba(WHITE, 0.9 * k)); g.addColorStop(0.4, E.rgba(PALE, 0.5 * k)); g.addColorStop(1, E.rgba(BLUE, 0)); ctx.fillStyle = g; ctx.beginPath(); ctx.arc(a.x, a.y, 18 * k + 0.1, 0, 6.2832); ctx.fill(); }
      // static crawl
      for (const c of T.crawl) { ctx.strokeStyle = E.rgba(PALE, Math.min(1, c.life * 8)); ctx.lineWidth = 1.2; ctx.beginPath(); const n = 6; for (let i = 0; i <= n; i++) { const a = c.a + c.len * i / n, r = c.r + (Math.random() - 0.5) * 8; const x = E.cx + Math.cos(a) * r, y = E.cy + Math.sin(a) * r; if (i) ctx.lineTo(x, y); else ctx.moveTo(x, y); } ctx.stroke(); }
      // bolts: body, core, filament (the outer glow goes to the bloom layer)
      for (const b of T.bolts) {
        const k = b.life / b.max, fl = 0.7 + Math.random() * 0.3, jit = 1.5;
        if (!E.bloom) drawBoltPass(ctx, b, 14, BLUE, 0.18 * k * fl, 0);
        drawBoltPass(ctx, b, 5, BLUE, 0.55 * k * fl, jit);
        drawBoltPass(ctx, b, 2.2, PALE, 0.9 * k * fl, jit);
        drawBoltPass(ctx, b, 0.8, WHITE, k * fl, 0);
      }
      // sparks
      const P = E.P, st = E.stride;
      for (let i = 0; i < P.n; i += st) { if (!P.alive[i]) continue; const x = P.x[i], y = P.y[i]; if (!E.onScreen(x, y)) continue; const lf = P.life[i] / P.max[i]; ctx.fillStyle = E.rgba(P.kind[i] === 1 ? PALE : GOLD, lf); const s = P.size[i] * E.strideSize; if (P.kind[i] === 1) { ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + P.vx[i] * 0.02 + (Math.random() - 0.5) * 6, y + P.vy[i] * 0.02 + (Math.random() - 0.5) * 6); ctx.stroke(); } else ctx.fillRect(x - s / 2, y - s / 2, s, s); }
    },
    drawGlow(g) {
      const s = E.gs;
      g.save(); g.scale(s, s);
      for (const b of T.bolts) { const k = b.life / b.max; drawBoltPass(g, b, 34, BLUE, 0.5 * k, 0); drawBoltPass(g, b, 14, PALE, 0.5 * k, 0); }
      for (const a of T.arrivals) { if (a.t < 0) continue; const k = Math.min(1, a.t * 3); g.fillStyle = E.rgba(PALE, 0.6 * k); g.beginPath(); g.arc(a.x, a.y, 30 * k + 0.1, 0, 6.2832); g.fill(); }
      g.restore();
    },
    back2d(ctx, e, W, H) {
      const t = S.t; const grad = ctx.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, '#03060f'); grad.addColorStop(1, '#0b1630'); ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
      if (!cloudReady) prerenderCloud();
      const lit = 0.6 + T.sheet * 1.2 + T.flash * 1.5;
      ctx.globalAlpha = Math.min(1, 0.7 * lit);
      for (let i = 0; i < 6; i++) { const x = ((i * 0.23 + t * 0.012 * (1 + (i % 2))) % 1.3 - 0.15) * W, y = (0.15 + (i % 3) * 0.22) * H + Math.sin(t * 0.2 + i) * 12; ctx.drawImage(cloud, x, y, W * 0.45, H * 0.35); }
      ctx.globalAlpha = 1;
      ctx.strokeStyle = 'rgba(140,180,255,' + (0.18 + T.sheet * 0.3) + ')'; ctx.lineWidth = 1; ctx.beginPath();
      for (let i = 0; i < 60; i++) { const x = ((i * 0.0733 + (i % 7) * 0.013) % 1) * W, y = ((t * (0.8 + (i % 3) * 0.3) + i * 0.17) % 1.1) * H; ctx.moveTo(x, y); ctx.lineTo(x - 2, y + 14 + (i % 3) * 6); }
      ctx.stroke();
    },
    wake() { T.wakeT = 0; T.wakePhase = 0; },
    onPeak(level) { strike(E.clamp((level - 0.5) * 2, 0.2, 1), false); },
    onState(s) { if (s === 'speaking') T.charge = 0; },
    pulse(kind) { if (kind === 'switch') { T.flash = 0.5; } if (kind === 'receive') strike(0.35, false); },
    trail(x, y, vx, vy) { E.P.spawn(x, y, vx * 0.1 + E.rand(-30, 30), vy * 0.1 + E.rand(-30, 30), E.rand(0.15, 0.35), 1, 1); }
  };
  window.AsgardFX.registerRealm('thor', R);
})();
