/* ASGARD FX — LOKI: emerald and gold mischief. Registers itself with the engine. */
(function () {
  'use strict';
  if (!window.AsgardFX || !window.AsgardFX.registerRealm) return;
  const EMERALD = [46, 190, 110], BRIGHT = [110, 255, 170], GOLD = [255, 199, 64], BLACK = [4, 8, 6];
  let E, S;
  const L = { slip: 0, slipNext: 3, beat: 0, beatT: 0, sigil: 0, sigilRot: 0, wakeT: -1, shardT: 0 };
  // sixteen invented rune shapes: angular strokes in unit space, not a real alphabet
  const RUNES = []; (function () { let seed = 7; const r = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    for (let i = 0; i < 16; i++) { const segs = []; const n = 2 + ((r() * 3) | 0); let x = r() * 0.4 - 0.2, y = -0.5; for (let s = 0; s < n; s++) { const nx = x + (r() - 0.5) * 0.9, ny = y + r() * (1 / n) + 0.05; segs.push(x, y, nx, ny); x = nx; y = ny; if (r() < 0.5) { segs.push(x, y, x + (r() - 0.5) * 0.6, y); } } RUNES.push(segs); } })();
  const mist = document.createElement('canvas'); let mistReady = false;

  const FRAG = [
    'vec4 realm(vec2 uv){',
    ' float asp=u_res.x/max(1.,u_res.y); float t=u_time; vec2 p=uv;',
    ' float slip=u_a; if(slip>0.5){ float band=step(0.55,hash(vec2(floor(uv.y*38.),floor(t*60.)))); p.x+=band*0.035; }',   // a skipped moment
    ' vec2 cp=vec2(p.x*asp,p.y);',
    ' float horizon=smoothstep(0.55,0.0,abs(uv.y-0.32)*2.2);',
    ' vec3 col=mix(vec3(0.004,0.01,0.006),vec3(0.02,0.09,0.05),horizon*0.8);',
    ' float dcen=distance(cp,vec2(0.5*asp,0.5));',
    ' float part=1.0-u_listen*smoothstep(0.42,0.05,dcen);',                                  // mist parts toward the centre
    ' float m1=fbm(cp*1.8+vec2(t*0.03,-t*0.012));',
    ' float m2=fbm(cp*3.1-vec2(t*0.05,t*0.02)+4.2);',
    ' float mist=smoothstep(0.3,0.75,m1*0.6+m2*0.5)*part;',
    ' mist*=0.55+0.45*smoothstep(0.9,0.2,uv.y);',
    ' col+=vec3(0.10,0.55,0.30)*mist*0.55+vec3(0.9,0.75,0.25)*mist*mist*0.10;',
    ' float beat=u_b; float sig=u_c;',
    ' col+=vec3(0.25,1.0,0.55)*beat*exp(-dcen*4.0)*0.7;',                                     // the gem glow, beating with the voice
    ' float ring=abs(dcen-0.19)-0.006; col+=vec3(0.9,0.8,0.3)*sig*smoothstep(0.02,0.0,ring)*(0.6+0.4*sin(t*3.));',
    ' float wk=sin(clamp(u_wake,0.,1.)*3.1416); col+=vec3(0.3,1.0,0.5)*wk*wk*0.5;',
    ' col+=vec3(0.1,0.6,0.3)*slip*0.15*step(0.5,fract(uv.y*120.));',
    ' col*=smoothstep(0.0,0.5,1.0-length(uv-0.5)*0.95);',
    ' return vec4(col,1.0);}'
  ].join('\n');

  function prerenderMist() {
    mist.width = 256; mist.height = 128; const c = mist.getContext('2d'); c.clearRect(0, 0, 256, 128);
    for (let i = 0; i < 36; i++) { const x = Math.random() * 256, y = 30 + Math.random() * 70, r = 24 + Math.random() * 40; const g = E.radial(c, x, y, 0, r); g.addColorStop(0, 'rgba(46,190,110,0.14)'); g.addColorStop(1, 'rgba(46,190,110,0)'); c.fillStyle = g; c.fillRect(x - r, y - r, r * 2, r * 2); }
    mistReady = true;
  }
  function spawnRune(x, y, vx, vy, life, depth) { E.P.spawn(x, y, vx, vy, life, 10 + depth * 16, 1, (Math.random() * 16) | 0, depth, Math.random() * 6.2832); }
  function drawRune(ctx, idx, x, y, size, rot, color, alpha) {
    const segs = RUNES[idx & 15]; ctx.strokeStyle = E.rgba(color, alpha); ctx.lineWidth = Math.max(1, size * 0.09); ctx.lineCap = 'square';
    const c = Math.cos(rot), s = Math.sin(rot); ctx.beginPath();
    for (let i = 0; i < segs.length; i += 4) { const x0 = segs[i] * size, y0 = segs[i + 1] * size, x1 = segs[i + 2] * size, y1 = segs[i + 3] * size; ctx.moveTo(x + x0 * c - y0 * s, y + x0 * s + y0 * c); ctx.lineTo(x + x1 * c - y1 * s, y + x1 * s + y1 * c); }
    ctx.stroke();
  }

  const R = {
    id: 'loki', palette: [EMERALD, BLACK, GOLD], frag: FRAG,
    init(e) { E = e; S = e.S; },
    resize() { if (E) prerenderMist(); },
    enter() { L.sigil = 0; L.wakeT = -1; L.beat = 0; if (E.animated) for (let i = 0; i < 40; i++) spawnRune(E.rand(0, E.w), E.rand(0, E.h), E.rand(-8, 8), E.rand(-14, -3), E.rand(8, 16), Math.random()); },
    uniforms() { return { a: L.slip, b: L.beat, c: L.sigil }; },
    update(dt) {
      if (!E.animated) return;
      const P = E.P, thinking = S.state === 'thinking';
      // scanline slips: rare at idle, faster and faster while thinking
      L.slipNext -= dt * (thinking ? 1 + L.sigil * 6 : 1);
      L.slip = 0; if (L.slipNext <= 0) { L.slip = 1; L.slipNext = thinking ? 0.25 + Math.random() * 0.5 : 4 + Math.random() * 7; E.sfx.tone(2400 + Math.random() * 800, 0.03, 'square', 0.012); }
      L.sigil = E.lerp(L.sigil, thinking ? 1 : 0, Math.min(1, dt * (thinking ? 0.8 : 3)));
      L.sigilRot += dt * 0.35;
      // heartbeat with the voice: lub-dub every ~0.9 s, scaled by level
      L.beatT += dt; const bp = L.beatT % 0.9; const env = Math.exp(-bp * 9) + 0.6 * Math.exp(-Math.max(0, bp - 0.18) * 11) * (bp > 0.18 ? 1 : 0);
      L.beat = E.lerp(L.beat, S.state === 'speaking' ? env * (0.3 + S.level) : 0, Math.min(1, dt * 14));
      // keep the rune population up
      let alive = 0; for (let i = 0; i < P.n; i++) if (P.alive[i] && P.kind[i] === 1) alive++;
      if (alive < 40 / E.stride && Math.random() < dt * 4) spawnRune(E.rand(0, E.w), E.h + 20, E.rand(-8, 8), E.rand(-18, -5), E.rand(10, 18), Math.random());
      // runes converge into a slow-turning sigil behind the form while thinking
      const ring = Math.min(E.w, E.h) * 0.2;
      for (let i = 0; i < P.n; i++) {
        if (!P.alive[i] || P.kind[i] !== 1) continue;
        P.c[i] += dt * (0.2 + P.b[i] * 0.4) * (P.a[i] & 1 ? 1 : -1);
        if (L.sigil > 0.01) {
          const ang = L.sigilRot + (i % 24) / 24 * 6.2832, tx = E.cx + Math.cos(ang) * ring, ty = E.cy + Math.sin(ang) * ring;
          P.vx[i] += (tx - P.x[i]) * L.sigil * dt * 2.2; P.vy[i] += (ty - P.y[i]) * L.sigil * dt * 2.2; P.drag[i] = 1.8 * L.sigil;
          P.life[i] = Math.max(P.life[i], 2);
        } else P.drag[i] = 0;
        if (P.y[i] < -40) P.alive[i] = 0;
      }
      if (L.wakeT >= 0) { L.wakeT += dt; if (L.wakeT > 0.5 && L.wakeT - dt <= 0.5) { // the sigil snaps shut and shatters
          for (let i = 0; i < P.n; i++) if (P.alive[i] && P.kind[i] === 1) { const a = Math.atan2(P.y[i] - E.cy, P.x[i] - E.cx); P.vx[i] = Math.cos(a) * E.rand(300, 700); P.vy[i] = Math.sin(a) * E.rand(300, 700); P.drag[i] = 1.2; P.life[i] = E.rand(1.5, 3); }
          for (let i = 0; i < 30; i++) { const a = Math.random() * 6.2832; spawnRune(E.cx, E.cy, Math.cos(a) * E.rand(300, 800), Math.sin(a) * E.rand(300, 800), E.rand(1.5, 3), Math.random()); }
          E.flash(0.6, BRIGHT, 0.3); E.ring(E.cx, E.cy, GOLD, 1300, 3); L.sigil = 0; }
        if (L.wakeT > 2) L.wakeT = -1; }
      P.step(dt);
    },
    draw(ctx) {
      if (!E.animated) return;
      const P = E.P, st = E.stride, t = S.t;
      for (let i = 0; i < P.n; i += st) {
        if (!P.alive[i]) continue; const x = P.x[i], y = P.y[i]; if (!E.onScreen(x, y, 40)) continue;
        const lf = Math.min(1, P.life[i] / P.max[i] * 3, (P.max[i] - P.life[i]) * 2);
        if (P.kind[i] === 1) { const d = P.b[i]; drawRune(ctx, P.a[i], x, y, P.size[i] * E.strideSize, P.c[i], d > 0.6 ? GOLD : EMERALD, (0.15 + d * 0.5) * lf + L.sigil * 0.3); }
        else { ctx.fillStyle = E.rgba(BRIGHT, lf * 0.9); const s = P.size[i]; ctx.fillRect(x - s / 2, y - s / 2, s, s); }
      }
      // wake: the sigil closing
      if (L.wakeT >= 0 && L.wakeT < 0.5) { const k = 1 - L.wakeT / 0.5, r = Math.min(E.w, E.h) * (0.2 + 0.4 * k * k); ctx.strokeStyle = E.rgba(GOLD, 0.9); ctx.lineWidth = 2 + 4 * (1 - k); ctx.beginPath(); ctx.arc(E.cx, E.cy, Math.max(0.1, r), 0, 6.2832); ctx.stroke(); for (let i = 0; i < 8; i++) { const a = i / 8 * 6.2832 + t; drawRune(ctx, i * 2, E.cx + Math.cos(a) * r, E.cy + Math.sin(a) * r, 22, a, GOLD, 0.9); } }
      // mirror-shard duplicates of the transcript, one frame, gone
      if (S.state === 'speaking' && Math.random() < 0.06) { const lr = E.transcriptLead(); if (lr) { ctx.save(); ctx.font = '11px "Courier New", monospace'; ctx.fillStyle = E.rgba(BRIGHT, 0.85); ctx.translate(lr.x + lr.w + E.rand(10, 60), lr.y + lr.h * 0.85 + E.rand(-20, 20)); ctx.scale(-1, 1); ctx.fillText(lr.text, 0, 0); ctx.restore(); } }
    },
    drawGlow(g) {
      const s = E.gs, P = E.P;
      g.fillStyle = E.rgba(EMERALD, 0.35);
      for (let i = 0; i < P.n; i += E.stride * 2) { if (!P.alive[i]) continue; const x = P.x[i] * s, y = P.y[i] * s; if (x > -6 && x < g.canvas.width + 6 && y > -6 && y < g.canvas.height + 6) g.fillRect(x - 3, y - 3, 6, 6); }
      if (L.beat > 0.05) { const gr = E.radial(g, E.cx * s, E.cy * s, 0, 120 * s * (0.5 + L.beat)); gr.addColorStop(0, E.rgba(BRIGHT, L.beat * 0.6)); gr.addColorStop(1, E.rgba(EMERALD, 0)); g.fillStyle = gr; g.fillRect(0, 0, g.canvas.width, g.canvas.height); }
    },
    back2d(ctx, e, W, H) {
      const t = S.t; const grad = ctx.createLinearGradient(0, 0, 0, H); grad.addColorStop(0, '#010402'); grad.addColorStop(0.68, '#04180c'); grad.addColorStop(1, '#020805'); ctx.fillStyle = grad; ctx.fillRect(0, 0, W, H);
      if (!mistReady) prerenderMist();
      for (let i = 0; i < 5; i++) { const x = ((i * 0.27 + t * 0.01 * (1 + (i % 2))) % 1.3 - 0.15) * W, y = (0.45 + (i % 3) * 0.15) * H; ctx.drawImage(mist, x, y, W * 0.5, H * 0.3); }
      if (L.beat > 0.05) { const g = E.radial(ctx, W / 2, H / 2, 0, W * 0.25 * L.beat); g.addColorStop(0, E.rgba(BRIGHT, L.beat * 0.4)); g.addColorStop(1, E.rgba(EMERALD, 0)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H); }
      if (L.slip) { ctx.fillStyle = 'rgba(46,190,110,0.12)'; for (let y = 0; y < H; y += 6) if (Math.random() < 0.3) ctx.fillRect(0, y, W, 2); }
    },
    wake() { L.wakeT = 0; L.sigil = 1; },
    pulse(kind) { if (kind === 'receive') { E.ring(E.cx, E.cy, EMERALD, 900, 2); } if (kind === 'send') { L.slip = 1; } },
    trail(x, y, vx, vy) { E.P.spawn(x, y, vx * 0.05 + E.rand(-20, 20), vy * 0.05 + E.rand(-40, -5), E.rand(0.4, 0.9), E.rand(1.5, 3), 2); }
  };
  window.AsgardFX.registerRealm('loki', R);
})();
