/* ASGARD FX — the hall's living backdrop and reactive effects layer.
   One engine, four realms. THOR / LOKI / ODIN live in /fx/<id>.js and register
   themselves here; the fourth realm is built in. The hall talks to this file
   through window.AsgardFX only, every call wrapped in try/catch on its side,
   and every method here is safe before init and safe to call twice.

   Rendering: two full-screen canvases with pointer-events:none. The BACK
   canvas (z 0, under the reactor) is WebGL2 → WebGL1 → 2D and carries the
   realm sky. The OVER canvas (z 60, above the panels, under any modal) is 2D
   and carries bolts, particles, rings, the wipe, transcript effects and the
   pointer trail. Glow is a fake bloom: a quarter-resolution offscreen canvas
   drawn back up with smoothing. No CSS filters anywhere on an animated layer.

   ?fx=0 disables the whole layer. ?debug=1 shows FPS / tier / RENDER PATH.   */
(function () {
  'use strict';
  if (window.AsgardFX && window.AsgardFX.__real) return;

  // ------------------------------------------------------------------ utils
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const finite = (v, d) => (typeof v === 'number' && isFinite(v) ? v : d);
  const nowMs = () => performance.now();
  const q = (function () { try { return new URLSearchParams(location.search); } catch (e) { return { get: () => null }; } })();
  const DISABLED = q.get('fx') === '0';
  const DEBUG = q.get('debug') === '1';
  const PINQ = DEBUG && q.get('q') !== null ? clamp(parseInt(q.get('q'), 10) || 0, 0, 4) : -1;   // ?debug=1&q=N pins the quality tier for testing
  const REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const LS = { get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }, set(k, v) { try { localStorage.setItem(k, v); } catch (e) {} } };
  const KEY_MUTE = 'asgardfx:mute', KEY_TIER = 'asgardfx:tier';

  // Safe radial gradient: every radius finite and positive, or a flat fill.
  function radial(ctx, x, y, r0, r1) {
    x = finite(x, 0); y = finite(y, 0);
    r0 = Math.max(0, finite(r0, 0)); r1 = Math.max(r0 + 0.01, finite(r1, 1));
    return ctx.createRadialGradient(x, y, r0, x, y, r1);
  }
  const rgba = (c, a) => 'rgba(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ',' + clamp(finite(a, 0), 0, 1).toFixed(3) + ')';

  // CSS filter matrices, so a hue-rotate/saturate done here matches the one the
  // hall's stylesheet does to the pixel. (Filter Effects Module Level 1.)
  function hueRotate(c, deg) {
    const a = deg * Math.PI / 180, cs = Math.cos(a), sn = Math.sin(a);
    const m = [
      0.213 + cs * 0.787 - sn * 0.213, 0.715 - cs * 0.715 - sn * 0.715, 0.072 - cs * 0.072 + sn * 0.928,
      0.213 - cs * 0.213 + sn * 0.143, 0.715 + cs * 0.285 + sn * 0.140, 0.072 - cs * 0.072 - sn * 0.283,
      0.213 - cs * 0.213 - sn * 0.787, 0.715 - cs * 0.715 + sn * 0.715, 0.072 + cs * 0.928 + sn * 0.072];
    return [clamp(m[0] * c[0] + m[1] * c[1] + m[2] * c[2], 0, 255), clamp(m[3] * c[0] + m[4] * c[1] + m[5] * c[2], 0, 255), clamp(m[6] * c[0] + m[7] * c[1] + m[8] * c[2], 0, 255)];
  }
  function saturate(c, s) {
    const m = [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s, 0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s, 0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s];
    return [clamp(m[0] * c[0] + m[1] * c[1] + m[2] * c[2], 0, 255), clamp(m[3] * c[0] + m[4] * c[1] + m[5] * c[2], 0, 255), clamp(m[6] * c[0] + m[7] * c[1] + m[8] * c[2], 0, 255)];
  }
  const brighten = (c, b) => [clamp(c[0] * b, 0, 255), clamp(c[1] * b, 0, 255), clamp(c[2] * b, 0, 255)];
  const mixc = (a, b, t) => [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)];

  // --------------------------------------------------------- particle pool
  // Fixed typed arrays, round-robin slot reuse, zero per-frame allocation.
  function Pool(n) {
    this.n = n; this.cursor = 0;
    this.alive = new Uint8Array(n); this.kind = new Uint8Array(n);
    this.x = new Float32Array(n); this.y = new Float32Array(n);
    this.vx = new Float32Array(n); this.vy = new Float32Array(n);
    this.ax = new Float32Array(n); this.ay = new Float32Array(n);
    this.drag = new Float32Array(n); this.life = new Float32Array(n); this.max = new Float32Array(n);
    this.size = new Float32Array(n); this.a = new Float32Array(n); this.b = new Float32Array(n); this.c = new Float32Array(n);
  }
  Pool.prototype.spawn = function (x, y, vx, vy, life, size, kind, a, b, c) {
    if (!(x > -1e6 && x < 1e6 && y > -1e6 && y < 1e6)) return -1;   // NaN rejected
    let i = this.cursor, tries = this.n;
    while (tries-- > 0) { if (!this.alive[i]) break; i = (i + 1) % this.n; }
    if (this.alive[i]) return -1;
    this.cursor = (i + 1) % this.n;
    this.alive[i] = 1; this.kind[i] = kind | 0;
    this.x[i] = x; this.y[i] = y; this.vx[i] = vx || 0; this.vy[i] = vy || 0;
    this.ax[i] = 0; this.ay[i] = 0; this.drag[i] = 0;
    this.life[i] = life; this.max[i] = life; this.size[i] = size;
    this.a[i] = a || 0; this.b[i] = b || 0; this.c[i] = c || 0;
    return i;
  };
  Pool.prototype.step = function (dt) {
    const n = this.n;
    for (let i = 0; i < n; i++) {
      if (!this.alive[i]) continue;
      this.life[i] -= dt;
      if (!(this.life[i] > 0)) { this.alive[i] = 0; continue; }
      this.vx[i] += this.ax[i] * dt; this.vy[i] += this.ay[i] * dt;
      const d = this.drag[i]; if (d > 0) { const k = Math.max(0, 1 - d * dt); this.vx[i] *= k; this.vy[i] *= k; }
      this.x[i] += this.vx[i] * dt; this.y[i] += this.vy[i] * dt;
    }
  };
  Pool.prototype.clear = function () { this.alive.fill(0); };
  Pool.prototype.count = function () { let c = 0; for (let i = 0; i < this.n; i++) c += this.alive[i]; return c; };

  // ----------------------------------------------------------- SFX synth
  // Everything synthesized. Silent until the first user gesture. One master
  // gain so mute is a single knob. A low realm hum sits under everything.
  const SFX = {
    ctx: null, master: null, hum: null, humGain: null, humFilter: null, unlocked: false, muted: LS.get(KEY_MUTE) === '1',
    unlock() {
      if (this.unlocked) return;
      try {
        const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
        this.ctx = new AC(); this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.9; this.master.connect(this.ctx.destination);
        this.unlocked = true;
        if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
        this.startHum(S.persona);
      } catch (e) { this.unlocked = false; }
    },
    setMuted(m) { this.muted = !!m; LS.set(KEY_MUTE, m ? '1' : '0'); if (this.master) this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.05); },
    tone(freq, dur, type, gain, delay, slideTo, attack) {
      if (!this.unlocked) return; const c = this.ctx, t0 = c.currentTime + (delay || 0);
      try {
        const o = c.createOscillator(), g = c.createGain();
        o.type = type || 'sine'; o.frequency.setValueAtTime(Math.max(20, freq), t0);
        if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + (attack || 0.01));
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        o.connect(g); g.connect(this.master); o.start(t0); o.stop(t0 + dur + 0.05);
      } catch (e) {}
    },
    noise(dur, gain, cutoff, delay, cutoffEnd, type) {
      if (!this.unlocked) return; const c = this.ctx, t0 = c.currentTime + (delay || 0);
      try {
        const len = Math.max(1, Math.floor(c.sampleRate * Math.min(4, dur)));
        const buf = c.createBuffer(1, len, c.sampleRate), d = buf.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        const src = c.createBufferSource(); src.buffer = buf;
        const f = c.createBiquadFilter(); f.type = type || 'lowpass'; f.frequency.setValueAtTime(cutoff || 800, t0);
        if (cutoffEnd) f.frequency.exponentialRampToValueAtTime(Math.max(30, cutoffEnd), t0 + dur);
        const g = c.createGain(); g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, gain), t0 + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
        src.connect(f); f.connect(g); g.connect(this.master); src.start(t0); src.stop(t0 + dur + 0.05);
      } catch (e) {}
    },
    send() { this.tone(520, 0.09, 'sine', 0.05, 0, 900); this.tone(1040, 0.06, 'triangle', 0.02, 0.05); },
    receive() { this.tone(880, 0.08, 'sine', 0.045); this.tone(660, 0.14, 'sine', 0.04, 0.07, 520); },
    error() { this.tone(160, 0.22, 'sawtooth', 0.05, 0, 110); this.noise(0.18, 0.03, 600, 0.02, 200); },
    switch() { this.noise(0.45, 0.06, 300, 0, 4000, 'bandpass'); this.tone(240, 0.3, 'sine', 0.04, 0.05, 480); },
    thunder(delay, vol) {
      const v = clamp(vol, 0.05, 0.6);
      this.noise(0.12, v * 0.9, 3000, delay, 400);                // the crack
      this.noise(1.6 + v * 1.5, v * 0.7, 220, delay + 0.08, 45);  // the roll
      this.tone(38, 1.4 + v, 'sine', v * 0.35, delay + 0.1, 28);
    },
    wake(id) {
      if (id === 'thor') { this.thunder(0, 0.5); this.tone(110, 0.9, 'sawtooth', 0.05, 0.05, 55); }
      else if (id === 'loki') { for (let i = 0; i < 6; i++) this.tone(1200 + i * 260, 0.25, 'triangle', 0.025, i * 0.05); this.noise(0.6, 0.04, 2500, 0.1, 500, 'highpass'); }
      else if (id === 'odin') { this.tone(65.4, 2.6, 'sine', 0.16, 0, 0, 0.6); this.tone(98, 2.4, 'sine', 0.10, 0.05, 0, 0.7); this.tone(130.8, 2.2, 'triangle', 0.05, 0.1, 0, 0.8); this.tone(196, 2.0, 'sine', 0.04, 0.2, 0, 0.9); }
      else if (id === 'hela') { this.tone(41, 3.0, 'sine', 0.12, 0, 36, 0.8); this.noise(2.2, 0.05, 160, 0.1, 60); }
    },
    vault(kind) {
      if (kind === 'lock-in') { this.tone(55, 1.2, 'sawtooth', 0.06, 0, 32); this.noise(0.5, 0.06, 900, 0, 120); }
      else if (kind === 'stand-down') { this.tone(120, 0.9, 'sine', 0.05, 0, 70); }
      else if (kind === 'vault-close') { this.noise(0.7, 0.05, 500, 0, 40); this.tone(48, 0.8, 'sine', 0.08, 0, 30); }
    },
    startHum(id) {
      if (!this.unlocked) return;
      try {
        if (!this.hum) {
          this.hum = this.ctx.createOscillator(); this.humFilter = this.ctx.createBiquadFilter(); this.humGain = this.ctx.createGain();
          this.hum.type = 'sawtooth'; this.humFilter.type = 'lowpass'; this.humFilter.Q.value = 2;
          this.humGain.gain.value = 0.0001;
          this.hum.connect(this.humFilter); this.humFilter.connect(this.humGain); this.humGain.connect(this.master); this.hum.start();
        }
        const cfg = { thor: [55, 140, 0.018], loki: [61.7, 260, 0.014], odin: [49, 120, 0.02], hela: [36.7, 90, 0.026] }[id] || [55, 140, 0.015];
        const t = this.ctx.currentTime;
        this.hum.frequency.setTargetAtTime(cfg[0], t, 0.4); this.humFilter.frequency.setTargetAtTime(cfg[1], t, 0.4);
        this.humGain.gain.setTargetAtTime(cfg[2], t, 0.8);
      } catch (e) {}
    }
  };

  // ------------------------------------------------------------- state
  const S = {
    inited: false, persona: 'thor', state: 'idle', level: 0, hallLevel: 0, synth: 0,
    listen: 0, think: 0, speak: 0,        // smoothed 0..1 state weights the shaders read
    t: 0, dt: 0, frame: 0, fps: 60, lowSince: 0,
    tier: '2d', path: '2D', quality: clamp(LS.get(KEY_TIER) === null ? 2 : (parseInt(LS.get(KEY_TIER), 10) || 0), 0, 4),   // a browser with no measured tier starts one tier down with bloom off (Strike Three, unverified hardware)
    hidden: false, glLost: false,
    wake: null, wipe: null, pending: null,
    helaOpen: false, switchSfx: false, helaPhase: 'off', helaT: 0, helaRed: 0, helaLock: false, helaDrain: 0,
    peakAt: 0, prevLevel: 0, lowLevelSince: 0, phraseArmed: true, receiveAt: -1e9, wakeAt: -1e9,
    flashes: [], rings: [], ptr: { x: -100, y: -100, vx: 0, vy: 0, at: 0, seen: false },
    w: 1, h: 1, dpr: 1, cx: 0.5, cy: 0.5
  };
  const REALMS = {};
  const FX = { __real: true, version: 2 };
  window.AsgardFX = FX;

  // -------------------------------------------------------- canvases
  let back, over, octx, gl = null, glow, gctx, back2, b2ctx, dbg;
  const GS = 0.25;  // glow (bloom) scale
  const BS = 0.5;   // backdrop internal scale — the sky is soft, half-res is invisible
  function makeCanvases() {
    back = document.createElement('canvas'); back.id = 'asgardFxBack';
    back.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:0;pointer-events:none;display:block;';
    over = document.createElement('canvas'); over.id = 'asgardFxOver';
    over.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;z-index:60;pointer-events:none;display:block;';
    document.body.appendChild(back); document.body.appendChild(over);
    octx = over.getContext('2d');
    glow = document.createElement('canvas'); gctx = glow.getContext('2d');
    if (DEBUG) {
      dbg = document.createElement('div');
      dbg.style.cssText = 'position:fixed;left:8px;bottom:8px;z-index:9999;font:11px/1.4 monospace;color:#9ff;background:rgba(0,0,0,.55);padding:4px 7px;border-radius:4px;pointer-events:none;white-space:pre;';
      document.body.appendChild(dbg);
    }
  }

  // ------------------------------------------------------------- WebGL
  const VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*0.5+0.5;gl_Position=vec4(p,0.,1.);}';
  const PRELUDE = [
    'precision mediump float;',
    'varying vec2 v;',
    'uniform vec2 u_res;uniform float u_time;uniform float u_level;uniform float u_listen;uniform float u_think;uniform float u_speak;',
    'uniform float u_wake;uniform float u_a;uniform float u_b;uniform float u_c;uniform float u_q;',
    'float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
    'float noise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.-2.*f);',
    ' float a=hash(i),b=hash(i+vec2(1.,0.)),c=hash(i+vec2(0.,1.)),d=hash(i+vec2(1.,1.));',
    ' return mix(mix(a,b,f.x),mix(c,d,f.x),f.y);}',
    'float fbm(vec2 p){float s=0.,a=0.5;for(int i=0;i<5;i++){s+=a*noise(p);p=p*2.03+vec2(17.1,9.7);a*=0.5;}return s;}',
    'float fbm3(vec2 p){float s=0.,a=0.5;for(int i=0;i<3;i++){s+=a*noise(p);p=p*2.03+vec2(17.1,9.7);a*=0.5;}return s;}'
  ].join('\n');
  const WIPE_FS = 'precision mediump float;varying vec2 v;uniform sampler2D u_tex;uniform float u_edge;uniform float u_aspect;void main(){float d=(v.x*u_aspect+(1.-v.y))/(u_aspect+1.);float a=1.-smoothstep(u_edge-0.06,u_edge,d);vec4 c=texture2D(u_tex,v);gl_FragColor=vec4(c.rgb,a);}';
  const GL = { progs: {}, wipe: null, tex: null, buf: null, uni: {} };

  function compile(g, type, src) {
    const sh = g.createShader(type); g.shaderSource(sh, src); g.compileShader(sh);
    if (!g.getShaderParameter(sh, g.COMPILE_STATUS)) { const log = g.getShaderInfoLog(sh); g.deleteShader(sh); throw new Error('shader: ' + log); }
    return sh;
  }
  function program(g, fs) {
    const p = g.createProgram();
    g.attachShader(p, compile(g, g.VERTEX_SHADER, VS)); g.attachShader(p, compile(g, g.FRAGMENT_SHADER, fs)); g.linkProgram(p);
    if (!g.getProgramParameter(p, g.LINK_STATUS)) throw new Error('link: ' + g.getProgramInfoLog(p));
    return p;
  }
  function initGL() {
    gl = null; GL.progs = {}; GL.wipe = null; GL.tex = null;
    // depth: true — the Strike Three arc cores render into this same context and need a depth buffer; the sky quad never tests depth, so it costs the sky nothing.
    const opts = { alpha: true, antialias: false, depth: true, stencil: false, premultipliedAlpha: false, preserveDrawingBuffer: true, powerPreference: 'low-power', failIfMajorPerformanceCaveat: false };
    try { gl = back.getContext('webgl2', opts); if (gl) S.tier = 'webgl2'; } catch (e) { gl = null; }
    if (!gl) { try { gl = back.getContext('webgl', opts) || back.getContext('experimental-webgl', opts); if (gl) S.tier = 'webgl1'; } catch (e) { gl = null; } }
    if (!gl) { S.tier = '2d'; S.path = '2D'; setup2DBack(); return; }
    try {
      GL.buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, GL.buf);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
      GL.wipe = program(gl, WIPE_FS);
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      S.path = S.tier === 'webgl2' ? 'WebGL2' : 'WebGL1';
    } catch (e) { gl = null; S.tier = '2d'; S.path = '2D'; setup2DBack(); }
  }
  function realmProgram(id) {
    if (!gl) return null;
    if (GL.progs[id] !== undefined) return GL.progs[id];
    const r = REALMS[id];
    if (!r || !r.frag) { GL.progs[id] = null; return null; }
    try {
      const p = program(gl, PRELUDE + '\n' + r.frag + '\nvoid main(){gl_FragColor=realm(v);}');
      const u = {}; ['u_res', 'u_time', 'u_level', 'u_listen', 'u_think', 'u_speak', 'u_wake', 'u_a', 'u_b', 'u_c', 'u_q'].forEach(n => { u[n] = gl.getUniformLocation(p, n); });
      GL.progs[id] = { p, u, attr: gl.getAttribLocation(p, 'p') };
    } catch (e) { console.warn('[AsgardFX] realm shader failed for', id, e.message); GL.progs[id] = null; }
    return GL.progs[id];
  }
  function setup2DBack() {
    // 2D tier: the back canvas becomes a plain 2D context. A canvas that already
    // had a (lost) GL context can't switch, so we swap the element.
    if (back2) return;
    const nb = document.createElement('canvas'); nb.id = back.id; nb.style.cssText = back.style.cssText;
    back.parentNode && back.parentNode.replaceChild(nb, back);
    back = nb; back2 = nb; b2ctx = nb.getContext('2d');
    sizeCanvases();
  }

  // --------------------------------------------------------- sizing
  let resizeTimer = 0;
  function sizeCanvases() {
    S.w = Math.max(1, window.innerWidth); S.h = Math.max(1, window.innerHeight);
    S.dpr = S.quality >= 3 ? 1 : Math.min(1.25, window.devicePixelRatio || 1);   // conservative cap (Strike Three): 1.25, was 1.5
    S.cx = S.w / 2; S.cy = S.h / 2;
    const bs = C.mode === 'three' ? 1 : BS;   // a modeled core needs the full-resolution canvas; the sky alone is fine at half
    const bw = Math.max(2, Math.floor(S.w * S.dpr * bs)), bh = Math.max(2, Math.floor(S.h * S.dpr * bs));
    if (back.width !== bw || back.height !== bh) { back.width = bw; back.height = bh; }
    const ow = Math.max(2, Math.floor(S.w * S.dpr)), oh = Math.max(2, Math.floor(S.h * S.dpr));
    if (over.width !== ow || over.height !== oh) { over.width = ow; over.height = oh; }
    glow.width = Math.max(2, Math.floor(ow * GS)); glow.height = Math.max(2, Math.floor(oh * GS));
    if (gl) gl.viewport(0, 0, bw, bh);
    coreResize(bw, bh);
    for (const id in REALMS) { const r = REALMS[id]; if (r.resize) { try { r.resize(E); } catch (e) {} } }
    helaResize();
  }
  function onResize() { clearTimeout(resizeTimer); resizeTimer = setTimeout(sizeCanvases, 150); }

  // ------------------------------------------------- helpers for realms
  const P = new Pool(1600);
  const E = {
    S, P, clamp, lerp, rand, finite, radial, rgba, mixc, hueRotate, saturate, brighten, sfx: SFX, REDUCED,
    get w() { return S.w; }, get h() { return S.h; }, get dpr() { return S.dpr; }, get cx() { return S.cx; }, get cy() { return S.cy; },
    get t() { return S.t; }, get q() { return S.quality; }, get level() { return S.level; }, get state() { return S.state; },
    get stride() { return S.quality >= 1 ? 2 : 1; },
    get strideSize() { return S.quality >= 1 ? Math.SQRT2 : 1; },
    get bloom() { return S.quality < 2; },
    get animated() { return S.quality < 4 && !REDUCED; },
    onScreen(x, y, m) { m = m || 8; return x > -m && x < S.w + m && y > -m && y < S.h + m; },
    flash(strength, color, dur) { if (S.flashes.length < 6) S.flashes.push({ a: clamp(finite(strength, 0), 0, 1), c: color || [255, 255, 255], t: 0, d: dur || 0.25 }); },
    ring(x, y, color, speed, width, maxR) { if (S.rings.length < 12) S.rings.push({ x: finite(x, S.cx), y: finite(y, S.cy), c: color || [255, 255, 255], r: 0, v: finite(speed, 600), w: finite(width, 3), m: finite(maxR, Math.max(S.w, S.h)), a: 1 }); },
    gctx() { return gctx; }, gs: GS,
    hall() { return document.documentElement; },
    transcriptLead() { return leadRect(); }
  };

  // ------------------------------------------------------- transcript
  // The hall writes whole replies at once. We watch #chatLog, wrap the new
  // reply into word spans, and reveal them timed to the speaking level, with a
  // per-realm glow on the leading word. Force-completes on a deadline.
  let chatObs = null, reveal = null;
  const GLOWS = { thor: '0 0 10px rgba(120,190,255,.95), 0 0 22px rgba(70,150,255,.6)', loki: '0 0 10px rgba(80,255,160,.95), 0 0 22px rgba(255,199,64,.45)', odin: '0 0 10px rgba(255,220,120,.95), 0 0 22px rgba(255,199,64,.6)', hela: '0 0 10px rgba(0,255,140,.95)' };
  function watchTranscript() {
    const log = document.getElementById('chatLog');
    if (!log || chatObs) return;
    chatObs = new MutationObserver(muts => {
      for (const m of muts) {
        if (m.addedNodes.length > 2) continue;                       // a full re-render of history, not a new reply
        const fresh = (nowMs() - S.receiveAt < 1500) || S.state === 'thinking' || (nowMs() - S.wakeAt < 6000);
        if (!fresh) continue;
        for (const n of m.addedNodes) {
        if (!(n instanceof HTMLElement) || !n.classList.contains('assistant')) continue;
        const txt = n.textContent || '';
        if (/^\s*\.\.\.\s*$/.test(txt.replace(/^[A-Z0-9 _—-]+/, ''))) continue;  // typing placeholder
        setTimeout(() => startReveal(n), 0);
        }
      }
    });
    chatObs.observe(log, { childList: true });
  }
  function startReveal(div) {
    try {
      if (REDUCED || div.dataset.fxDone) return;
      div.dataset.fxDone = '1';
      const nodes = []; for (const c of Array.from(div.childNodes)) if (c.nodeType === 3 && c.textContent.trim()) nodes.push(c);
      if (!nodes.length) return;
      const spans = [];
      for (const tn of nodes) {
        const frag = document.createDocumentFragment();
        const parts = tn.textContent.split(/(\s+)/);
        for (const part of parts) {
          if (!part) continue;
          if (/^\s+$/.test(part)) { frag.appendChild(document.createTextNode(part)); continue; }
          const sp = document.createElement('span'); sp.textContent = part; sp.style.opacity = '0'; sp.style.transition = 'opacity .12s linear'; spans.push(sp); frag.appendChild(sp);
        }
        tn.parentNode.replaceChild(frag, tn);
      }
      if (!spans.length) return;
      if (reveal) finishReveal();
      const est = Math.max(1.2, spans.length / 2.6);        // ~155 wpm
      reveal = { spans, i: 0, acc: 0, t: 0, est, deadline: est * 1.35 + 1.0, lead: null };
    } catch (e) {}
  }
  function stepReveal(dt) {
    if (!reveal) return;
    const r = reveal; r.t += dt;
    const rate = spans => spans / r.est;                                  // words per second at the measured pace
    const drive = S.state === 'speaking' ? (0.8 + S.level * 1.4) : (S.state === 'thinking' ? 0 : 1.1);
    r.acc += dt * rate(r.spans.length) * drive;
    while (r.i < r.spans.length && r.acc >= 1) { showWord(r.i); r.i++; r.acc -= 1; }
    if (r.t > r.deadline || (S.state === 'idle' && r.t > 0.6 && r.i < r.spans.length && r.t > r.est)) finishReveal();
    if (r.i >= r.spans.length) finishReveal();
  }
  function showWord(i) {
    const r = reveal, sp = r.spans[i];
    sp.style.opacity = '1';
    if (r.lead) r.lead.style.textShadow = '';
    sp.style.textShadow = GLOWS[S.persona] || GLOWS.thor; r.lead = sp;
  }
  function finishReveal() {
    if (!reveal) return;
    for (const sp of reveal.spans) { sp.style.opacity = '1'; sp.style.textShadow = ''; }
    const last = reveal.spans[reveal.spans.length - 1];
    if (last) { last.style.textShadow = GLOWS[S.persona] || ''; setTimeout(() => { last.style.textShadow = ''; }, 900); }
    reveal = null;
  }
  function leadRect() {
    if (!reveal || !reveal.lead) return null;
    try { const b = reveal.lead.getBoundingClientRect(); if (!(b.width > 0)) return null; return { x: b.left, y: b.top, w: b.width, h: b.height, text: reveal.lead.textContent }; } catch (e) { return null; }
  }

  // -------------------------------------------------------- pointer
  let lastTrail = 0;
  function onPointer(e) {
    const p = S.ptr, t = nowMs();
    const x = finite(e.clientX, p.x), y = finite(e.clientY, p.y), dtm = Math.max(8, t - p.at);
    p.vx = (x - p.x) / dtm * 1000; p.vy = (y - p.y) / dtm * 1000; p.x = x; p.y = y; p.at = t; p.seen = true;
    if (!E.animated || t - lastTrail < 18) return;
    lastTrail = t;
    const r = activeRealm(); if (r && r.trail) { try { r.trail(x, y, p.vx, p.vy, E); } catch (err) {} }
  }
  function onGesture() { SFX.unlock(); }

  // --------------------------------------------------- level & peaks
  function readHallLevel() {
    let v = NaN;
    try { if (window.Reactor && typeof window.Reactor.audioLevel === 'number') v = window.Reactor.audioLevel; } catch (e) {}
    if (!isFinite(v)) { try { v = parseFloat(document.documentElement.style.getPropertyValue('--voice')); } catch (e) { v = NaN; } }
    return isFinite(v) ? clamp(v, 0, 1) : NaN;
  }
  let hallSilent = 0;
  function stepLevel(dt) {
    if (S.state !== 'speaking') { S.level = lerp(S.level, 0, Math.min(1, dt * 10)); S.synth = 0; return; }
    const hv = readHallLevel();
    if (isFinite(hv) && hv > 0.02) { hallSilent = 0; S.level = hv; }
    else {
      hallSilent += dt;
      if (hallSilent > 1.2) {   // the hall isn't reporting — synthesize a speech-like envelope from a timer
        S.synth += dt;
        const s = S.synth, env = 0.35 + 0.3 * Math.abs(Math.sin(s * 5.1)) * (0.6 + 0.4 * Math.abs(Math.sin(s * 1.7 + 0.4))) + 0.15 * Math.abs(Math.sin(s * 13.3));
        S.level = lerp(S.level, clamp(env, 0, 1), Math.min(1, dt * 12));
      } else S.level = lerp(S.level, isFinite(hv) ? hv : 0, Math.min(1, dt * 10));
    }
    // peak: a rising edge over 0.55 with a refractory period
    const t = S.t;
    if (S.level > 0.55 && S.level > S.prevLevel * 1.15 && t - S.peakAt > 0.32) { S.peakAt = t; const r = activeRealm(); if (r && r.onPeak) { try { r.onPeak(S.level, E); } catch (e) {} } }
    // phrase onset: crossing 0.25 upward after a real dip
    if (S.level < 0.12) { S.lowLevelSince += dt; if (S.lowLevelSince > 0.12) S.phraseArmed = true; } else S.lowLevelSince = 0;
    if (S.phraseArmed && S.level > 0.25) { S.phraseArmed = false; const r = activeRealm(); if (r && r.onPhrase) { try { r.onPhrase(S.level, E); } catch (e) {} } }
    S.prevLevel = S.level;
  }

  // -------------------------------------------------------- realms
  const FALLBACK = {
    palette: { thor: [[70, 150, 255], [255, 255, 255], [255, 199, 64]], loki: [[46, 190, 110], [8, 10, 8], [255, 199, 64]], odin: [[255, 199, 64], [12, 20, 48], [246, 244, 236]], hela: [[0, 255, 140], [1, 3, 2], [0, 255, 140]] },
    back2d(ctx, id) {
      const c = FALLBACK.palette[id] || FALLBACK.palette.thor;
      const g = radial(ctx, S.cx * BS * S.dpr, S.cy * BS * S.dpr * 0.8, 10, Math.max(S.w, S.h) * BS * S.dpr);
      g.addColorStop(0, rgba(mixc(c[0], [0, 0, 0], 0.7), 1)); g.addColorStop(1, rgba([2, 3, 6], 1));
      ctx.fillStyle = g; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    }
  };
  function activeRealm() { return S.persona === 'hela' ? HELA : REALMS[S.persona] || null; }
  function loadRealmScripts() {
    for (const id of ['thor', 'loki', 'odin']) {
      if (REALMS[id]) continue;
      const s = document.createElement('script'); s.src = '/fx/' + id + '.js'; s.async = true;
      s.onerror = () => console.warn('[AsgardFX] realm file missing:', id);
      document.head.appendChild(s);
    }
  }
  FX.registerRealm = function (id, realm) {
    if (!id || !realm) return;
    REALMS[id] = realm;
    if (S.inited) { try { realm.init && realm.init(E); realm.resize && realm.resize(E); } catch (e) { console.warn('[AsgardFX] realm init failed', id, e); } if (gl) realmProgram(id); }
  };

  // ---------------------------------------------------------- cores
  // Strike Three. The modeled arc cores render INSIDE this engine's WebGL2
  // context — the back canvas — through Three.js: no new canvas, no second
  // context. A core module is loaded by the engine from /fx/cores/<id>.js,
  // registers itself with FX.registerCore, and is driven from this frame
  // loop. Only the three visible gods have a core; any other persona leaves
  // the cores layer disposed. The contract: docs/CORE_MODULE_CONTRACT.md.
  const CORE_IDS = ['thor', 'loki', 'odin'];
  const CORES = {};
  const THREE_URLS = ['https://cdn.jsdelivr.net/npm/three@0.185.1/build/three.module.js', 'https://unpkg.com/three@0.185.1/build/three.module.js', 'https://esm.sh/three@0.185.1'];
  const CORE_PALETTE = {
    base: { pearl: 0xECEAF2, plum: 0x292337, void: 0x0B0A12, silver: 0xC8D1DC, petrol: 0x285E6B, uv: 0x7965CF },
    thor: { core: 0xEAF8FF, rim: 0x66C7FF }, loki: { core: 0xE7C24A, rim: 0xD8AF5C }, odin: { core: 0xD8AE5A, rim: 0xA56429 }
  };
  const BLIT_FS = 'precision mediump float;varying vec2 v;uniform sampler2D u_tex;void main(){gl_FragColor=vec4(texture2D(u_tex,v).rgb,1.0);}';
  const C = { want: false, THREE: null, threeP: null, renderer: null, scene: null, camera: null, tmp: null, active: null, id: null, ctx: null, mode: 'none', mounting: false, loading: {}, fbo: null, fboTex: null, fw: 0, fh: 0, blit: null, skyDirty: true, skyDirect: false, skipFrame: false, quality: -1, err: null, force: 0, tris: 0, calls: 0 };
  function loadThree() {
    if (C.threeP) return C.threeP;
    C.threeP = (async function () {
      if (typeof window.__loadThree === 'function') { try { return await window.__loadThree(); } catch (e) { console.warn('[AsgardFX] the hall\'s three.js loader failed:', e && e.message); } }
      let last = null;
      for (let i = 0; i < THREE_URLS.length; i++) {
        try { const m = await import(THREE_URLS[i]); if (i > 0) console.warn('[AsgardFX] three.js loaded from mirror ' + (i + 1) + ': ' + THREE_URLS[i]); return m; }
        catch (e) { last = e; console.warn('[AsgardFX] three.js mirror unavailable: ' + THREE_URLS[i]); }
      }
      throw last || new Error('three.js unavailable from every mirror');
    })();
    return C.threeP;
  }
  function loadCoreModule(id) {
    if (CORES[id] || C.loading[id]) return;
    C.loading[id] = 'loading';
    const src = '/fx/cores/' + id + '.js';
    const viaTag = () => { const s = document.createElement('script'); s.src = src; s.async = true; s.onerror = () => { C.err = 'core file missing: ' + src; C.loading[id] = 'failed'; }; document.head.appendChild(s); };
    try { import(src).then(() => { if (!CORES[id]) { C.err = 'core module did not register: ' + id; C.loading[id] = 'failed'; } }).catch(e => { console.warn('[AsgardFX] core import failed, trying a script tag:', e && e.message); viaTag(); }); }
    catch (e) { viaTag(); }
  }
  FX.registerCore = function (id, mod) {
    if (!id || !mod || CORE_IDS.indexOf(id) < 0) return;
    if (typeof mod.init !== 'function' || typeof mod.update !== 'function' || typeof mod.dispose !== 'function' || typeof mod.setState !== 'function') { console.warn('[AsgardFX] core module incomplete:', id); return; }
    CORES[id] = mod; C.loading[id] = 'done';
  };
  FX.cores = function (on) { C.want = !!on; };
  function coreSupported() { return !!gl && !S.glLost && S.tier === 'webgl2'; }
  function desiredCore() { return (C.want && CORE_IDS.indexOf(S.persona) >= 0) ? S.persona : null; }
  function makeCoreCtx(id) {
    const pal = Object.assign({}, CORE_PALETTE.base, CORE_PALETTE[id] || {});
    return {
      THREE: C.THREE, renderer: C.renderer, scene: C.scene, camera: C.camera, tier: S.tier, persona: id, palette: pal, reduced: REDUCED, sfx: SFX,
      get w() { return S.w; }, get h() { return S.h; }, get dpr() { return S.dpr; }, get quality() { return S.quality; }, get still() { return !E.animated; },
      get level() { return S.level; }, get listen() { return S.listen; }, get think() { return S.think; }, get speak() { return S.speak; }, get t() { return S.t; }, get state() { return S.state; },
      ring(x, y, color, speed, width, maxR) { E.ring(x, y, color, speed, width, maxR); },
      flash(strength, color, dur) { E.flash(strength, color, dur); },
      project(v, out) { out = out || { x: 0, y: 0 }; const cam = C.camera, p = C.tmp; if (!cam || !p) { out.x = S.cx; out.y = S.cy; return out; } p.copy(v).project(cam); out.x = (p.x * 0.5 + 0.5) * S.w; out.y = (-p.y * 0.5 + 0.5) * S.h; return out; }
    };
  }
  async function ensureRenderer() {
    if (C.renderer) return true;
    const THREE = await loadThree();
    if (!coreSupported()) return false;
    C.THREE = THREE;
    const rd = new THREE.WebGLRenderer({ canvas: back, context: gl, alpha: true, antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: true, powerPreference: 'low-power' });
    rd.autoClear = false; rd.setPixelRatio(1); rd.setSize(back.width, back.height, false);
    rd.toneMapping = THREE.NeutralToneMapping || THREE.ACESFilmicToneMapping; rd.toneMappingExposure = 1.0; rd.shadowMap.enabled = false;
    C.renderer = rd; C.scene = new THREE.Scene(); C.camera = new THREE.PerspectiveCamera(30, back.width / Math.max(1, back.height), 0.1, 80); C.tmp = new THREE.Vector3();
    return true;
  }
  function mountCore(id) {
    if (C.mounting) return;
    C.mounting = true; C.err = null;
    (async function () {
      try {
        let ok = false;
        try { ok = await ensureRenderer(); } catch (e) { C.err = (e && e.message) || String(e); console.warn('[AsgardFX] three.js unavailable:', e); ok = false; }
        const mod = CORES[id];
        if (!mod || S.persona !== id || !C.want) return;            // the world moved on while three.js was loading
        if (!ok) { mount2d(id, mod); return; }
        C.active = mod; C.id = id; C.mode = 'three'; C.quality = S.quality; C.ctx = makeCoreCtx(id);
        mod.init(C.ctx);
        sizeCanvases();                                              // full-res canvas, framebuffer, camera aspect, mod.resize
        mod.setState(S.state, S.level);
        C.skyDirty = true; C.force = 3;
      } catch (e) {
        // a fault inside the core module itself: log it verbatim, keep the sky, show it on ?debug=1
        C.err = (e && e.message) || String(e); console.warn('[AsgardFX] core init failed:', id, e);
        const mod = C.active; C.active = null; C.id = null; C.ctx = null; C.mode = 'none';
        if (mod) { try { mod.dispose(); } catch (e2) {} if (C.scene) { try { C.scene.clear(); } catch (e3) {} } }
        C.loading[id] = 'failed'; delete CORES[id];
        sizeCanvases();
      } finally { C.mounting = false; }
    })();
  }
  function mount2d(id, mod) {
    if (gl && !S.glLost) dropTo2D('no WebGL2 core is possible here, so the core draws in 2D');
    C.active = mod; C.id = id; C.mode = '2d'; C.ctx = makeCoreCtx(id); C.quality = S.quality;
    try { mod.setState(S.state, S.level); } catch (e) {}
    S.staticDrawn = null; C.force = 3;
  }
  function dropTo2D(reason) {
    console.warn('[AsgardFX] cores: dropping the layer to 2D — ' + reason);
    if (C.renderer) { try { C.renderer.dispose(); } catch (e) {} }
    C.renderer = null; C.scene = null; C.camera = null; C.tmp = null; C.fbo = null; C.fboTex = null; C.blit = null;
    gl = null; S.tier = '2d'; S.path = '2D'; setup2DBack();
  }
  function unmountCore() {
    const mod = C.active, was = C.mode;
    C.active = null; C.id = null; C.ctx = null; C.mode = 'none'; C.skyDirty = true; C.force = 3;
    if (mod && was === 'three') {
      try { mod.dispose(); } catch (e) { console.warn('[AsgardFX] core dispose failed:', e && e.message); }
      if (C.scene) { try { C.scene.clear(); } catch (e) {} }
      sizeCanvases();                                                // back to the half-res sky
    }
  }
  function coreFailed(e) {
    const id = C.id; C.err = (e && e.message) || String(e); console.warn('[AsgardFX] core failed:', id, e);
    if (id) { C.loading[id] = 'failed'; delete CORES[id]; }
    unmountCore();
  }
  function coreContextLost() {
    // the context is gone: drop every GL-side handle without calling GL; the 2D fallback mounts on the next frame
    if (C.active && C.mode === 'three') { C.active = null; C.id = null; C.ctx = null; }
    C.renderer = null; C.scene = null; C.camera = null; C.tmp = null; C.fbo = null; C.fboTex = null; C.blit = null; C.mode = 'none'; C.skyDirty = true;
  }
  function reconcileCore() {
    const want = desiredCore();
    if (C.id && C.id !== want) unmountCore();
    if (want && !C.id && !C.mounting) {
      const mod = CORES[want];
      if (mod) { if (coreSupported()) mountCore(want); else mount2d(want, mod); }
      else if (C.loading[want] !== 'failed') loadCoreModule(want);
    }
    if (C.active && C.quality !== S.quality) { C.quality = S.quality; if (C.active.setQuality) { try { C.active.setQuality(S.quality); } catch (e) {} } C.skyDirty = true; C.force = 3; }
  }
  function coreResize(bw, bh) {
    if (C.mode !== 'three' || !C.renderer) return;
    try {
      C.renderer.setSize(bw, bh, false); C.camera.aspect = bw / Math.max(1, bh); C.camera.updateProjectionMatrix();
      if (!C.skyDirect) ensureFbo();
      if (C.active && C.active.resize) C.active.resize(S.w, S.h, C.ctx);
    } catch (e) { coreFailed(e); return; }
    C.skyDirty = true; C.force = 3;
  }
  // The sky under a core: rendered once into a half-size framebuffer and blitted each frame.
  function ensureFbo() {
    if (!gl) return false;
    const fw = Math.max(2, Math.floor(back.width * 0.5)), fh = Math.max(2, Math.floor(back.height * 0.5));
    if (C.fbo && C.fw === fw && C.fh === fh) return true;
    try {
      if (!C.blit) { const p = program(gl, BLIT_FS); C.blit = { p, attr: gl.getAttribLocation(p, 'p'), u_tex: gl.getUniformLocation(p, 'u_tex') }; }
      if (!C.fboTex) C.fboTex = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, C.fboTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, fw, fh, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      if (!C.fbo) C.fbo = gl.createFramebuffer();
      gl.bindFramebuffer(gl.FRAMEBUFFER, C.fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, C.fboTex, 0);
      const ok = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      if (!ok) { C.skyDirect = true; console.warn('[AsgardFX] sky framebuffer incomplete; drawing the sky direct'); return false; }
      C.fw = fw; C.fh = fh; C.skyDirty = true; return true;
    } catch (e) { C.skyDirect = true; console.warn('[AsgardFX] sky framebuffer failed:', e && e.message); return false; }
  }
  // Three.js and the raw sky share one context. Before any raw draw the state
  // is set explicitly (Three leaves its own behind); before Three draws,
  // renderer.resetState() re-syncs its cache with what the raw pass changed.
  function rawBegin() {
    if (gl.bindVertexArray) gl.bindVertexArray(null);
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.disable(gl.DEPTH_TEST); gl.depthMask(false); gl.disable(gl.CULL_FACE); gl.disable(gl.SCISSOR_TEST); gl.disable(gl.STENCIL_TEST);
    gl.colorMask(true, true, true, true); gl.blendEquation(gl.FUNC_ADD); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.viewport(0, 0, back.width, back.height); gl.activeTexture(gl.TEXTURE0);
  }
  function drawRealmQuad(pr, r, w, h) {
    gl.useProgram(pr.p); gl.bindBuffer(gl.ARRAY_BUFFER, GL.buf); gl.enableVertexAttribArray(pr.attr); gl.vertexAttribPointer(pr.attr, 2, gl.FLOAT, false, 0, 0);
    const u = pr.u, ru = (r && r.uniforms) ? (r.uniforms(E) || {}) : {};
    gl.uniform2f(u.u_res, w, h); gl.uniform1f(u.u_time, S.t);
    gl.uniform1f(u.u_level, S.level); gl.uniform1f(u.u_listen, S.listen); gl.uniform1f(u.u_think, S.think); gl.uniform1f(u.u_speak, S.speak);
    gl.uniform1f(u.u_wake, S.wake ? clamp(S.wake.t / S.wake.d, 0, 1) : 0);
    gl.uniform1f(u.u_a, finite(ru.a, 0)); gl.uniform1f(u.u_b, finite(ru.b, 0)); gl.uniform1f(u.u_c, finite(ru.c, 0)); gl.uniform1f(u.u_q, S.quality);
    gl.disable(gl.BLEND); gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function drawWipeRaw() {
    if (!(S.wipe && GL.wipe && GL.tex)) return;
    gl.enable(gl.BLEND); gl.useProgram(GL.wipe);
    const a = gl.getAttribLocation(GL.wipe, 'p'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, GL.tex);
    gl.uniform1i(gl.getUniformLocation(GL.wipe, 'u_tex'), 0);
    gl.uniform1f(gl.getUniformLocation(GL.wipe, 'u_edge'), clamp(S.wipe.t / S.wipe.d, 0, 1) * 1.12);
    gl.uniform1f(gl.getUniformLocation(GL.wipe, 'u_aspect'), back.width / back.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function drawSkyForCore(r) {
    const skip = !E.animated && !S.wipe && !S.wake && C.force <= 0 && !C.skyDirty;
    C.skipFrame = skip; if (skip) return;                              // still mode: the last composite stays on the preserved canvas
    if (C.force > 0) C.force--;
    rawBegin();
    const pr = realmProgram(S.persona);
    if (!pr) { gl.clearColor(0.043, 0.039, 0.07, 1); gl.clear(gl.COLOR_BUFFER_BIT); drawWipeRaw(); return; }
    if (!C.skyDirect && ensureFbo()) {
      if (C.skyDirty || S.wake) {                                         // static under a core: re-rendered only on a structural change, or during a wake
        gl.bindFramebuffer(gl.FRAMEBUFFER, C.fbo); gl.viewport(0, 0, C.fw, C.fh);
        drawRealmQuad(pr, r, C.fw, C.fh);
        gl.bindFramebuffer(gl.FRAMEBUFFER, null); gl.viewport(0, 0, back.width, back.height);
        C.skyDirty = false;
      }
      gl.useProgram(C.blit.p); gl.bindBuffer(gl.ARRAY_BUFFER, GL.buf); gl.enableVertexAttribArray(C.blit.attr); gl.vertexAttribPointer(C.blit.attr, 2, gl.FLOAT, false, 0, 0);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, C.fboTex); gl.uniform1i(C.blit.u_tex, 0);
      gl.disable(gl.BLEND); gl.drawArrays(gl.TRIANGLES, 0, 3);
    } else drawRealmQuad(pr, r, back.width, back.height);              // no framebuffer: the sky draws direct at full size (costlier, still right)
    drawWipeRaw();
  }
  function drawCore() {
    if (C.mode !== 'three' || !C.active || !C.renderer || !gl || S.glLost || C.skipFrame) return;
    const rd = C.renderer; rd.resetState(); rd.clearDepth(); rd.render(C.scene, C.camera);
    C.tris = rd.info.render.triangles; C.calls = rd.info.render.calls;
  }
  function coreDebug() { return '\nCORE ' + (C.id || 'none') + '  ' + C.mode + (C.mode === 'three' ? '  tris ' + C.tris + '  calls ' + C.calls : '') + (C.err ? '\nCORE ERR ' + C.err : ''); }

  // -------------------------------------------------- persona switch
  function requestPersona(id) {
    if (!id || (id !== 'thor' && id !== 'loki' && id !== 'odin' && id !== 'hela')) return;
    if (id === S.persona) return;
    if (!S.inited) { S.persona = id; return; }
    S.pending = id; S.switchSfx = true;   // applied at the top of the next frame so the old sky can be snapshotted first
  }
  let snap = null, snapCtx = null;
  function applyPending() {
    const id = S.pending; S.pending = null;
    if (!id || id === S.persona) return;
    const prev = S.persona;
    // snapshot the old sky for the wipe (from the just-rendered frame)
    let haveSnap = false;
    if (E.animated && prev !== 'hela' && id !== 'hela') {
      try {
        if (!snap) { snap = document.createElement('canvas'); snapCtx = snap.getContext('2d'); }
        snap.width = back.width; snap.height = back.height; snapCtx.drawImage(back, 0, 0); haveSnap = true;
        if (gl) { if (!GL.tex) GL.tex = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, GL.tex); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, snap); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE); }
      } catch (e) { haveSnap = false; }
    }
    S.persona = id;
    P.clear();
    const r = activeRealm(); if (r && r.enter) { try { r.enter(E, prev); } catch (e) {} }
    SFX.startHum(id);
    if (S.switchSfx && prev !== 'hela' && id !== 'hela') { SFX.switch(); if (r && r.pulse) { try { r.pulse('switch', E); } catch (e) {} } }
    S.switchSfx = false;
    if (haveSnap) S.wipe = { t: 0, d: 0.6, deadline: 0.9, from: prev };
    over.style.zIndex = id === 'hela' ? '305' : '60';
  }

  // -------------------------------------------------- HELA (built in)
  // Only while the vault is open. Draws on the overlay because her cell is an
  // opaque layer. Green embers, black smoke at the edges, antler shadows far
  // back, a slow pulse; lock-in hue-shifts the whole layer red exactly the way
  // her stylesheet does (hue-rotate(-152deg) saturate(1.45) brightness(1.05)).
  const HELA = (function () {
    const GREEN = [0, 255, 140];
    const RED = brighten(saturate(hueRotate(GREEN, -152), 1.45), 1.05);
    const smoke = document.createElement('canvas'); let smokeReady = false;
    const antlers = []; for (let i = 0; i < 4; i++) antlers.push({ x: Math.random(), y: 0.25 + Math.random() * 0.5, s: 0.6 + Math.random() * 0.8, ph: Math.random() * 6.28, dir: Math.random() < 0.5 ? -1 : 1 });
    const tendrils = []; for (let i = 0; i < 14; i++) tendrils.push({ edge: i % 4, u: Math.random(), ph: Math.random() * 6.28, sp: 0.15 + Math.random() * 0.25, len: 0.12 + Math.random() * 0.2 });
    let emberAcc = 0, wave = null;
    function col() { return mixc(GREEN, RED, S.helaRed); }
    function prerender() {
      // one soft black puff sprite, drawn many times as the smoke
      smoke.width = smoke.height = 128; const c = smoke.getContext('2d');
      const g = radial(c, 64, 64, 0, 64); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(0.6, 'rgba(0,0,0,0.18)'); g.addColorStop(1, 'rgba(0,0,0,0)');
      c.fillStyle = g; c.fillRect(0, 0, 128, 128); smokeReady = true;
    }
    function drawAntler(ctx, x, y, s, a, c) {
      ctx.strokeStyle = rgba(c, a); ctx.lineWidth = 2.2 * s; ctx.lineCap = 'round';
      const seg = (x0, y0, ang, len, depth) => {
        const x1 = x0 + Math.cos(ang) * len, y1 = y0 + Math.sin(ang) * len;
        ctx.moveTo(x0, y0); ctx.lineTo(x1, y1);
        if (depth > 0) { seg(x1, y1, ang - 0.55, len * 0.62, depth - 1); seg(x1, y1, ang + 0.35, len * 0.7, depth - 1); }
      };
      ctx.beginPath(); seg(x, y, -Math.PI / 2 - 0.5, 70 * s, 3); seg(x, y, -Math.PI / 2 + 0.5, 70 * s, 3); ctx.stroke();
    }
    return {
      id: 'hela',
      enter() { S.helaRed = 0; S.helaLock = false; S.helaPhase = 'on'; S.helaDrain = 0; if (!smokeReady) prerender(); },
      resize() {},
      wake() { for (let i = 0; i < 90; i++) P.spawn(S.cx + rand(-80, 80), S.cy + rand(-40, 40), rand(-120, 120), rand(-260, -40), rand(1.5, 3.5), rand(1.5, 3.5), 1); wave = { r: 0, a: 1 }; SFX.wake('hela'); },
      pulse(kind) {
        if (kind === 'lock-in') { S.helaLock = true; wave = { r: 0, a: 1 }; for (let i = 0; i < 60; i++) P.spawn(S.cx + rand(-30, 30), S.cy - 80 + rand(-30, 30), rand(-320, 320), rand(-360, 60), rand(0.6, 1.4), rand(1, 2.5), 2); SFX.vault('lock-in'); }
        if (kind === 'stand-down') { S.helaLock = false; SFX.vault('stand-down'); }
        if (kind === 'vault-close') { S.helaPhase = 'drain'; S.helaDrain = 0; SFX.vault('vault-close'); for (let i = 0; i < P.n; i++) if (P.alive[i]) { P.vy[i] = rand(400, 900); P.ay[i] = 1400; } }
      },
      update(dt) {
        const target = S.helaLock ? 1 : 0;
        S.helaRed += clamp(target - S.helaRed, -dt / 0.6, dt / 0.6);            // both ways over the same 600 ms
        if (S.helaPhase === 'drain') { S.helaDrain += dt; if (S.helaDrain > 0.7) { S.helaPhase = 'off'; finishVault(); return; } }
        if (!E.animated) return;
        const speed = S.helaLock ? 2.2 : 1;
        emberAcc += dt * (S.helaLock ? 70 : 28) / E.stride;
        while (emberAcc >= 1) {
          emberAcc -= 1;
          P.spawn(rand(0, S.w), S.h + 6, rand(-14, 14) * speed, -rand(22, 70) * speed, rand(4, 9) / speed, rand(1, 2.6) * E.strideSize, S.helaLock ? 2 : 1);
        }
        for (let i = 0; i < P.n; i++) if (P.alive[i]) { if (P.kind[i] === 1) { P.vx[i] += Math.sin(S.t * 1.3 + P.y[i] * 0.02) * 8 * dt; } }
        P.step(dt);
        if (wave) { wave.r += dt * 900; wave.a -= dt * 1.4; if (wave.a <= 0) wave = null; }
        for (const t of tendrils) t.u = (t.u + dt * t.sp * speed * 0.08) % 1;
      },
      draw(ctx) {
        const c = col(), w = S.w, h = S.h, t = S.t;
        const drain = S.helaPhase === 'drain' ? S.helaDrain / 0.7 : 0;
        const dy = drain > 0 ? (drain * drain) * h : 0;
        ctx.save(); ctx.translate(0, dy); ctx.globalAlpha = 1 - drain * 0.6;
        // slow pulse under everything
        const pulse = 0.5 + 0.5 * Math.sin(t * (S.helaLock ? 2.0 : 0.9));
        const g = radial(ctx, S.cx, S.cy, 0, Math.max(w, h) * 0.75);
        g.addColorStop(0, rgba(c, 0.035 + pulse * 0.03)); g.addColorStop(0.55, rgba(c, 0.012)); g.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
        // antler shadows, far back
        for (const a of antlers) {
          const ax = (a.x + Math.sin(t * 0.05 * a.dir + a.ph) * 0.08) * w, ay = a.y * h + Math.sin(t * 0.09 + a.ph) * 18;
          if (!E.onScreen(ax, ay, 200)) continue;
          drawAntler(ctx, ax, ay, a.s, 0.045 + 0.02 * Math.sin(t * 0.3 + a.ph), [0, 0, 0]);
          drawAntler(ctx, ax + 1.5, ay + 1.5, a.s, 0.03, c);
        }
        // smoke tendrils along the frame edges
        if (smokeReady) {
          for (const td of tendrils) {
            const k = td.u, wob = Math.sin(t * 0.7 + td.ph) * 30;
            let x, y; if (td.edge === 0) { x = k * w; y = -20 + wob * 0.5; } else if (td.edge === 1) { x = w + 20 - wob * 0.5; y = k * h; } else if (td.edge === 2) { x = w - k * w; y = h + 20 + wob * 0.5; } else { x = -20 + wob * 0.5; y = h - k * h; }
            for (let j = 0; j < 4; j++) { const s = (90 + j * 34) * (S.helaLock ? 1.25 : 1); if (E.onScreen(x, y, s)) ctx.drawImage(smoke, x - s / 2 + Math.sin(t * 0.9 + j + td.ph) * 22, y - s / 2 + Math.cos(t * 0.6 + j) * 16, s, s); }
          }
        }
        // embers / sparks
        const st = E.stride;
        for (let i = 0; i < P.n; i += st) {
          if (!P.alive[i]) continue; const x = P.x[i], y = P.y[i]; if (!E.onScreen(x, y)) continue;
          const lf = P.life[i] / P.max[i], s = P.size[i];
          const cc = P.kind[i] === 2 ? RED : c;
          ctx.fillStyle = rgba(cc, 0.25 + 0.6 * lf);
          if (P.kind[i] === 2) { ctx.fillRect(x - s * 0.4, y - s * 1.5, s * 0.8, s * 3); } else { ctx.beginPath(); ctx.arc(x, y, s, 0, 6.2832); ctx.fill(); }
        }
        if (wave) { ctx.strokeStyle = rgba(c, wave.a * 0.8); ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(S.cx, S.cy - 80, Math.max(0.1, wave.r), 0, 6.2832); ctx.stroke(); }
        ctx.restore();
      },
      drawGlow(g) {
        const c = col(), s = E.gs;
        const st = E.stride * 2;
        g.fillStyle = rgba(c, 0.5);
        for (let i = 0; i < P.n; i += st) { if (!P.alive[i]) continue; const x = P.x[i] * s, y = P.y[i] * s; if (x > -4 && x < glow.width + 4 && y > -4 && y < glow.height + 4) g.fillRect(x - 1.5, y - 1.5, 3, 3); }
        if (wave) { g.strokeStyle = rgba(c, wave.a * 0.5); g.lineWidth = 6; g.beginPath(); g.arc(S.cx * s, (S.cy - 80) * s, Math.max(0.1, wave.r * s), 0, 6.2832); g.stroke(); }
      },
      trail(x, y) { P.spawn(x, y, rand(-20, 20), rand(-60, -10), rand(0.6, 1.2), rand(1, 2), 1); }
    };
  })();
  function helaResize() {}
  function finishVault() {
    // back to whatever the hall says the persona is
    let id = 'thor'; try { id = document.documentElement.getAttribute('data-persona') || 'thor'; } catch (e) {}
    S.helaOpen = false; S.helaLock = false; S.helaRed = 0;
    if (!REALMS[id]) id = 'thor';
    S.persona = 'hela'; requestPersona(id);
  }

  // --------------------------------------------------------- backdrop
  function drawBackdrop() {
    if (S.persona === 'hela') { if (gl) { gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); } else if (b2ctx) b2ctx.clearRect(0, 0, back.width, back.height); return; }
    const r = REALMS[S.persona];
    const staticNow = !E.animated;
    if (C.mode === 'three' && gl && !S.glLost) { drawSkyForCore(r); return; }   // Strike Three: a static sky under a modeled core
    if (staticNow && S.staticDrawn === S.persona + ':' + back.width) return;   // static tier: sky drawn once
    S.staticDrawn = S.persona + ':' + back.width;
    if (gl && !S.glLost) {
      if (C.renderer) rawBegin();   // Three.js has used this context: put the raw state back before the sky quad
      const pr = realmProgram(S.persona);
      if (pr) {
        gl.useProgram(pr.p); gl.bindBuffer(gl.ARRAY_BUFFER, GL.buf); gl.enableVertexAttribArray(pr.attr); gl.vertexAttribPointer(pr.attr, 2, gl.FLOAT, false, 0, 0);
        const u = pr.u, ru = (r && r.uniforms) ? (r.uniforms(E) || {}) : {};
        gl.uniform2f(u.u_res, back.width, back.height); gl.uniform1f(u.u_time, staticNow ? 10 : S.t);
        gl.uniform1f(u.u_level, S.level); gl.uniform1f(u.u_listen, S.listen); gl.uniform1f(u.u_think, S.think); gl.uniform1f(u.u_speak, S.speak);
        gl.uniform1f(u.u_wake, S.wake ? clamp(S.wake.t / S.wake.d, 0, 1) : 0);
        gl.uniform1f(u.u_a, finite(ru.a, 0)); gl.uniform1f(u.u_b, finite(ru.b, 0)); gl.uniform1f(u.u_c, finite(ru.c, 0)); gl.uniform1f(u.u_q, S.quality);
        gl.disable(gl.BLEND); gl.drawArrays(gl.TRIANGLES, 0, 3);
        if (S.wipe && GL.wipe && GL.tex) {
          gl.enable(gl.BLEND); gl.useProgram(GL.wipe);
          const a = gl.getAttribLocation(GL.wipe, 'p'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
          gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, GL.tex);
          gl.uniform1i(gl.getUniformLocation(GL.wipe, 'u_tex'), 0);
          gl.uniform1f(gl.getUniformLocation(GL.wipe, 'u_edge'), clamp(S.wipe.t / S.wipe.d, 0, 1) * 1.12);
          gl.uniform1f(gl.getUniformLocation(GL.wipe, 'u_aspect'), back.width / back.height);
          gl.drawArrays(gl.TRIANGLES, 0, 3);
        }
        return;
      }
      // no program for this realm: paint the fallback sky through 2D on the glow canvas? No — clear and let CSS weather show.
      gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT); return;
    }
    if (!b2ctx) setup2DBack();
    if (!b2ctx) return;
    b2ctx.save(); b2ctx.setTransform(1, 0, 0, 1, 0, 0);
    if (r && r.back2d) { try { r.back2d(b2ctx, E, back.width, back.height); } catch (e) { FALLBACK.back2d(b2ctx, S.persona); } }
    else FALLBACK.back2d(b2ctx, S.persona);
    if (C.mode === '2d' && C.active && C.active.draw2d) { try { C.active.draw2d(b2ctx, back.width, back.height, C.ctx); } catch (e) { coreFailed(e); } }
    if (S.wipe && snap) {
      // keep the old sky only where the diagonal slice has not reached yet
      const sd = clamp(S.wipe.t / S.wipe.d, 0, 1) * 1.12 * 2, W = back.width, H = back.height;
      b2ctx.save(); b2ctx.beginPath();
      if (sd <= 1) { b2ctx.moveTo(sd * W, 0); b2ctx.lineTo(W, 0); b2ctx.lineTo(W, H); b2ctx.lineTo(0, H); b2ctx.lineTo(0, sd * H); }
      else { b2ctx.moveTo(W, (sd - 1) * H); b2ctx.lineTo(W, H); b2ctx.lineTo((sd - 1) * W, H); }
      b2ctx.closePath(); b2ctx.clip(); b2ctx.drawImage(snap, 0, 0); b2ctx.restore();
    }
    b2ctx.restore();
  }

  // ---------------------------------------------------------- overlay
  function drawOverlay(dt) {
    const ctx = octx, w = S.w, h = S.h;
    ctx.setTransform(S.dpr, 0, 0, S.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const useGlow = E.bloom && E.animated;
    if (useGlow) { gctx.setTransform(1, 0, 0, 1, 0, 0); gctx.clearRect(0, 0, glow.width, glow.height); }
    const r = activeRealm();
    if (r) {
      if (r.draw) { try { r.draw(ctx, E, dt); } catch (e) { if (DEBUG) console.warn(e); } }
      if (useGlow && r.drawGlow) { try { gctx.globalCompositeOperation = 'lighter'; r.drawGlow(gctx, E, dt); gctx.globalCompositeOperation = 'source-over'; } catch (e) {} }
    }
    // engine rings
    for (let i = S.rings.length - 1; i >= 0; i--) {
      const g = S.rings[i]; g.r += g.v * dt; g.a = 1 - g.r / g.m;
      if (!(g.a > 0) || !(g.r >= 0)) { S.rings.splice(i, 1); continue; }
      ctx.strokeStyle = rgba(g.c, g.a * 0.85); ctx.lineWidth = g.w; ctx.beginPath(); ctx.arc(g.x, g.y, Math.max(0.1, g.r), 0, 6.2832); ctx.stroke();
      if (useGlow) { gctx.strokeStyle = rgba(g.c, g.a * 0.6); gctx.lineWidth = g.w * 2.5 * GS + 2; gctx.beginPath(); gctx.arc(g.x * GS, g.y * GS, Math.max(0.1, g.r * GS), 0, 6.2832); gctx.stroke(); }
    }
    // bloom composite (source-over, the glow canvas is mostly transparent)
    if (useGlow) { ctx.imageSmoothingEnabled = true; ctx.drawImage(glow, 0, 0, w, h); }
    // wipe: the light slice on top of the dissolve
    if (S.wipe) {
      const k = clamp(S.wipe.t / S.wipe.d, 0, 1) * 1.12, d = k * (w + h);
      const c = (REALMS[S.persona] && REALMS[S.persona].palette && REALMS[S.persona].palette[0]) || [255, 255, 255];
      ctx.save(); ctx.globalCompositeOperation = 'lighter';
      const grad = ctx.createLinearGradient(d - 140, 0, d + 40, 0);
      grad.addColorStop(0, 'rgba(255,255,255,0)'); grad.addColorStop(0.7, rgba(c, 0.55)); grad.addColorStop(0.92, 'rgba(255,255,255,0.95)'); grad.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = grad; ctx.beginPath(); ctx.moveTo(d - 160, 0); ctx.lineTo(d + 60, 0); ctx.lineTo(d + 60 - h, h); ctx.lineTo(d - 160 - h, h); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    // screen flashes
    for (let i = S.flashes.length - 1; i >= 0; i--) {
      const f = S.flashes[i]; f.t += dt; const k = 1 - f.t / f.d;
      if (!(k > 0)) { S.flashes.splice(i, 1); continue; }
      ctx.fillStyle = rgba(f.c, f.a * k * k * 0.55); ctx.fillRect(0, 0, w, h);
    }
    // per-realm cursor dot + trail is spawned in onPointer; draw the cursor here
    if (S.ptr.seen && E.animated && nowMs() - S.ptr.at < 2500) {
      const c = (r && r.palette && r.palette[0]) || [255, 255, 255];
      const g = radial(ctx, S.ptr.x, S.ptr.y, 0, 14); g.addColorStop(0, rgba(c, 0.5)); g.addColorStop(1, rgba(c, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(S.ptr.x, S.ptr.y, 14, 0, 6.2832); ctx.fill();
    }
  }

  // ------------------------------------------------------------- loop
  let prevT = 0, rafId = 0, fpsAcc = 0, fpsN = 0, fpsT = 0;
  function frame(ts) {
    rafId = requestAnimationFrame(frame);
    if (S.hidden) return;
    let dt = (ts - prevT) / 1000; prevT = ts;
    if (!(dt >= 0)) dt = 0;           // NaN / negative first-frame delta rejected
    if (dt > 0.1) dt = 0.1;
    S.dt = dt; S.t += dt; S.frame++;
    // fps meter + governor
    fpsAcc += dt; fpsN++; if (fpsAcc >= 0.5) { S.fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }
    if (PINQ >= 0) S.quality = PINQ;
    else if (S.fps < 45 && dt > 0) { S.lowSince += dt; if (S.lowSince > 3) { S.lowSince = 0; if (S.quality < 4) { S.quality++; LS.set(KEY_TIER, String(S.quality)); if (S.quality === 3) sizeCanvases(); } } } else S.lowSince = 0;
    if (S.pending) applyPending();
    reconcileCore();
    // state weights
    const k = Math.min(1, dt * 4);
    S.listen = lerp(S.listen, S.state === 'listening' ? 1 : 0, k);
    S.think = lerp(S.think, S.state === 'thinking' ? 1 : 0, k);
    S.speak = lerp(S.speak, S.state === 'speaking' ? 1 : 0, k);
    stepLevel(dt);
    if (S.wake) { S.wake.t += dt; if (S.wake.t > S.wake.deadline || S.wake.t > S.wake.d) { S.wake = null; } }
    if (S.wipe) { S.wipe.t += dt; if (S.wipe.t > S.wipe.d * 1.12 || S.wipe.t > S.wipe.deadline) S.wipe = null; }
    const r = activeRealm();
    if (r && r.update) { try { r.update(dt, E); } catch (e) { if (DEBUG) console.warn(e); } }
    if (C.active && C.mode === 'three') { try { C.active.update(E.animated ? dt : 0, C.ctx); } catch (e) { coreFailed(e); } }
    try { drawBackdrop(); } catch (e) { if (DEBUG) console.warn(e); }
    try { drawCore(); } catch (e) { coreFailed(e); }
    try { drawOverlay(dt); } catch (e) { if (DEBUG) console.warn(e); }
    stepReveal(dt);
    if (dbg && (S.frame & 7) === 0) dbg.textContent = 'FPS ' + S.fps.toFixed(0) + '  TIER ' + S.tier + '  RENDER PATH ' + (S.glLost ? '2D (context lost)' : S.path) + '\nQ' + S.quality + '  ' + S.persona + '/' + S.state + '  lvl ' + S.level.toFixed(2) + '  p ' + P.count() + coreDebug();
  }

  // ----------------------------------------------------------- events
  function onVisibility() { S.hidden = !!document.hidden; if (!S.hidden) prevT = nowMs(); }
  function onLost(e) { try { e.preventDefault(); } catch (err) {} S.glLost = true; S.path = '2D'; gl = null; coreContextLost(); setup2DBack(); }
  function onRestored() { /* we've already moved to 2D; a restore is a bonus, nothing to do */ }

  // -------------------------------------------------------------- API
  FX.init = function (opts) {
    if (S.inited || DISABLED) return;
    if (!document.body) { document.addEventListener('DOMContentLoaded', () => FX.init(opts)); return; }
    S.inited = true;
    C.want = !!(opts && opts.cores);   // Strike Three: a page opts in to the modeled cores (fx-lab does; the hall does not yet)
    const want = (opts && opts.persona) || (function () { try { return document.documentElement.getAttribute('data-persona'); } catch (e) { return null; } })() || 'thor';
    if (want === 'thor' || want === 'loki' || want === 'odin') S.persona = want;
    if (REDUCED) S.quality = 4;
    if (PINQ >= 0) S.quality = PINQ;
    makeCanvases();
    initGL();
    back.addEventListener('webglcontextlost', onLost, false);
    back.addEventListener('webglcontextrestored', onRestored, false);
    sizeCanvases();
    loadRealmScripts();
    for (const id in REALMS) { try { REALMS[id].init && REALMS[id].init(E); REALMS[id].resize && REALMS[id].resize(E); } catch (e) {} }
    HELA.enter();
    S.persona = want === 'hela' ? 'thor' : S.persona;
    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pointermove', onPointer, { passive: true });
    window.addEventListener('pointerdown', onGesture, { passive: true });
    window.addEventListener('keydown', onGesture);
    window.addEventListener('touchstart', onGesture, { passive: true });
    watchTranscript();
    if (!document.getElementById('chatLog')) setTimeout(watchTranscript, 1500);
    // The hall stamps the active persona on <html data-persona>; following it
    // here means the layer is right even if a switch happens somewhere unhooked.
    try {
      new MutationObserver(() => {
        if (S.persona === 'hela' || S.helaOpen) return;   // her room decides for itself until it closes
        const id = document.documentElement.getAttribute('data-persona');
        if (id && id !== S.persona && id !== S.pending) requestPersona(id);
      }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-persona'] });
    } catch (e) {}
    prevT = nowMs();
    rafId = requestAnimationFrame(frame);
  };
  FX.setPersona = function (id) { requestPersona(id); };
  FX.setState = function (state, level) {
    if (state !== 'idle' && state !== 'listening' && state !== 'thinking' && state !== 'speaking') return;
    if (S.state !== state) { hallSilent = 0; S.synth = 0; S.phraseArmed = true; if (state === 'thinking') { SFX.send(); const rr = activeRealm(); if (rr && rr.pulse) { try { rr.pulse('send', E); } catch (e) {} } } }
    S.state = state;
    if (typeof level === 'number' && isFinite(level)) S.level = clamp(level, 0, 1);
    const r = activeRealm(); if (r && r.onState) { try { r.onState(state, E); } catch (e) {} }
    if (C.active) { try { C.active.setState(state, S.level); } catch (e) { coreFailed(e); } C.force = 3; if (C.mode === '2d') S.staticDrawn = null; }
  };
  FX.wake = function (id) {
    if (!S.inited) return;
    if (id === 'hela') { S.helaOpen = true; if (S.persona !== 'hela') { S.pending = 'hela'; applyPending(); } }
    else if (id && id !== S.persona && REALMS[id]) { S.pending = id; applyPending(); }
    if (S.wake) return;   // a wake is already running
    S.wake = { t: 0, d: 2.2, deadline: 4 }; S.wakeAt = nowMs();
    const r = activeRealm(); if (r && r.wake) { try { r.wake(E); } catch (e) {} }
    if (S.persona !== 'hela') SFX.wake(S.persona);
  };
  FX.pulse = function (kind) {
    if (!S.inited) return;
    if (kind === 'send') SFX.send(); else if (kind === 'receive') { SFX.receive(); S.receiveAt = nowMs(); } else if (kind === 'error') { SFX.error(); E.flash(0.35, [255, 60, 60], 0.3); if (S.state === 'thinking') S.state = 'idle'; } else if (kind === 'switch') SFX.switch();
    if (kind === 'vault-open') { S.helaOpen = true; P.clear(); return; }   // her room ignites on wake('hela'), once the hall's own opening animation is done
    if (kind === 'vault-close') { if (S.persona === 'hela') HELA.pulse('vault-close'); else { S.helaOpen = false; S.pending = null; } return; }
    if (kind === 'lock-in' || kind === 'stand-down') { if (S.persona === 'hela') HELA.pulse(kind); return; }
    const r = activeRealm(); if (r && r.pulse) { try { r.pulse(kind, E); } catch (e) {} }
  };
  FX.mute = function (m) { SFX.setMuted(!!m); };
  FX.status = function () { return { helaPhase: S.helaPhase, helaDrain: S.helaDrain, pending: S.pending, hallLevel: readHallLevel(), tier: S.tier, path: S.glLost ? '2D (context lost)' : S.path, fps: S.fps, quality: S.quality, persona: S.persona, state: S.state, level: S.level, particles: P.count(), realms: Object.keys(REALMS), core: { want: C.want, id: C.id, mode: C.mode, tris: C.tris, calls: C.calls, err: C.err } }; };
  if (DISABLED) { FX.init = function () {}; }
})();
