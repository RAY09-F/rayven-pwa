/* ASGARD FX — living backdrops + reactive effects for the hall.
 *
 * Frontend only. One file, no build step, no dependencies. Loaded by the hall
 * as <script src="/fx/asgard-fx.js"> and driven through window.AsgardFX.
 *
 * Layers: #fxBack (behind the reactor) and #fxOver (above it), both
 * pointer-events:none. The moving backdrop is a per-realm GLSL shader drawn to a
 * quarter-size offscreen canvas (WebGL2 -> WebGL1) and upscaled; particles and
 * flashes are canvas 2D. If no GL context survives, the backdrop is a single
 * pre-rendered 2D gradient and the particles keep going.
 *
 * Realms: thor (also the default "rayven" seat), loki, odin, and the one that
 * only exists while the vault is open. Public API:
 *   AsgardFX.init({persona}), setPersona(id), setState(state, level), wake(id),
 *   pulse(kind), mute(bool)
 * Storage: only 'asgardfx:mute' and 'asgardfx:tier'. Nothing else, ever.
 */
(function () {
  'use strict';
  if (window.AsgardFX) return;

  var qs = {};
  try { location.search.slice(1).split('&').forEach(function (p) { var kv = p.split('='); if (kv[0]) qs[decodeURIComponent(kv[0])] = decodeURIComponent(kv[1] || '1'); }); } catch (e) {}
  var DISABLED = qs.fx === '0';
  var DEBUG = qs.debug === '1';
  var REDUCED = false;
  try { REDUCED = !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches); } catch (e) {}

  // Personas the hall may report -> realm we draw. "rayven" holds Thor's seat.
  var REALM_OF = { rayven: 'thor', thor: 'thor', loki: 'loki', odin: 'odin', hela: 'hela', h9: 'hela' };
  var REALM_INDEX = { thor: 0, loki: 1, odin: 2, hela: 3 };

  var PALETTE = {
    thor: { main: [120, 170, 255], hot: [255, 255, 255], edge: [255, 205, 90], trail: [170, 210, 255], glow: 'rgba(140,180,255,' },
    loki: { main: [46, 200, 110], hot: [190, 255, 210], edge: [255, 199, 64], trail: [80, 230, 120], glow: 'rgba(60,220,120,' },
    odin: { main: [255, 199, 64], hot: [255, 245, 220], edge: [246, 244, 236], trail: [255, 215, 110], glow: 'rgba(255,205,90,' },
    hela: { main: [0, 255, 140], hot: [190, 255, 220], edge: [40, 90, 60], trail: [0, 230, 120], glow: 'rgba(0,255,140,' }
  };

  // ---------------------------------------------------------------------------
  // small utils — no allocation in the hot path
  // ---------------------------------------------------------------------------
  var clamp = function (v, a, b) { return v < a ? a : v > b ? b : v; };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var rnd = Math.random;
  var rr = function (a, b) { return a + (b - a) * rnd(); };
  function rgba(c, a) { return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a + ')'; }
  function mix3(a, b, t, out) { out[0] = (a[0] + (b[0] - a[0]) * t) | 0; out[1] = (a[1] + (b[1] - a[1]) * t) | 0; out[2] = (a[2] + (b[2] - a[2]) * t) | 0; return out; }
  var store = {
    get: function (k) { try { return localStorage.getItem('asgardfx:' + k); } catch (e) { return null; } },
    set: function (k, v) { try { localStorage.setItem('asgardfx:' + k, String(v)); } catch (e) {} }
  };

  // ---------------------------------------------------------------------------
  // state
  // ---------------------------------------------------------------------------
  var S = {
    realm: 'thor', prevRealm: null, state: 'idle',
    level: 0, levelSmooth: 0, levelAvg: 0, levelExternal: false, lastExternalAt: 0,
    peakCooldown: 0, speakStart: 0,
    tier: 0, dpr: 1, w: 0, h: 0, bw: 0, bh: 0, // back canvas css size / buffer size
    t: 0, dt: 0, last: 0, fps: 60, fpsAcc: 0, fpsN: 0, lowSince: 0,
    running: false, muted: false, glLost: false, renderPath: 'init',
    heat: 0, heatTarget: 0,           // 0 green .. 1 red (vault lock-in)
    wipe: 0, wipeFrom: null,          // realm-shift progress 0..1
    flash: 0, flashCol: [255, 255, 255],
    ignite: 0,                        // wake sky-ignite / sun-rise
    charge: 0,                        // thinking build-up
    listenW: 0, thinkW: 0, speakW: 0, // smoothed state weights
    drain: 0,                         // vault close drain
    vaultOpen: false, inCell: false,
    frozenDrawn: false
  };
  var TIER_NAMES = ['FULL', 'HALF-PARTICLES', 'NO-BLOOM', 'DPR-1', 'STATIC'];

  // ---------------------------------------------------------------------------
  // DOM — two canvases, both inert to input
  // ---------------------------------------------------------------------------
  var back, over, bctx, octx, glCanvas, gl, glVer = 0, bloomCanvas, bloomCtx, staticCanvas, debugEl;
  function makeCanvas(id, z) {
    var c = document.createElement('canvas');
    c.id = id;
    c.style.cssText = 'position:fixed;inset:0;width:100vw;height:100vh;pointer-events:none;z-index:' + z + ';display:block;';
    return c;
  }
  function mountLayers() {
    back = makeCanvas('fxBack', 0);
    over = makeCanvas('fxOver', 26);
    var bd = document.getElementById('backdrop');
    if (bd && bd.parentNode) bd.parentNode.insertBefore(back, bd.nextSibling); else document.body.insertBefore(back, document.body.firstChild);
    document.body.appendChild(over);
    bctx = back.getContext('2d', { alpha: true });
    octx = over.getContext('2d', { alpha: true });
    bloomCanvas = document.createElement('canvas'); bloomCtx = bloomCanvas.getContext('2d');
    staticCanvas = document.createElement('canvas');
    if (DEBUG) {
      debugEl = document.createElement('div');
      debugEl.id = 'fxDebug';
      debugEl.style.cssText = 'position:fixed;left:8px;top:8px;z-index:400;font:10px/1.5 monospace;color:#9fd;background:rgba(0,0,0,.55);padding:6px 8px;border:1px solid rgba(120,255,200,.3);pointer-events:auto;cursor:pointer;white-space:pre;';
      debugEl.title = 'click: toggle FX sound';
      debugEl.addEventListener('click', function () { API.mute(!S.muted); });
      document.body.appendChild(debugEl);
    }
  }
  function resize() {
    var cap = S.tier >= 3 ? 1 : 1.5;
    S.dpr = Math.min(window.devicePixelRatio || 1, cap);
    S.w = window.innerWidth; S.h = window.innerHeight;
    S.bw = Math.max(1, (S.w * S.dpr) | 0); S.bh = Math.max(1, (S.h * S.dpr) | 0);
    back.width = S.bw; back.height = S.bh; over.width = S.bw; over.height = S.bh;
    var q = 4; // shader + bloom run at quarter size
    glCanvas.width = Math.max(64, (S.bw / q) | 0); glCanvas.height = Math.max(64, (S.bh / q) | 0);
    bloomCanvas.width = glCanvas.width; bloomCanvas.height = glCanvas.height;
    if (gl && !S.glLost) gl.viewport(0, 0, glCanvas.width, glCanvas.height);
    prerenderStatic();
    layoutParticles();
    S.frozenDrawn = false;
  }
  var resizeTimer = null;
  function onResize() { clearTimeout(resizeTimer); resizeTimer = setTimeout(resize, 120); } // never inside the frame loop

  // ---------------------------------------------------------------------------
  // static layer — pre-rendered once per resize, the no-GL / STATIC-tier backdrop
  // ---------------------------------------------------------------------------
  function prerenderStatic() {
    var c = staticCanvas, w = Math.max(2, S.bw >> 2), h = Math.max(2, S.bh >> 2);
    c.width = w; c.height = h;
    var x = c.getContext('2d'), P = PALETTE[S.realm], g;
    if (S.realm === 'thor') {
      g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#05080f'); g.addColorStop(0.55, '#0c1a33'); g.addColorStop(1, '#03050a');
    } else if (S.realm === 'loki') {
      g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#02110a'); g.addColorStop(0.7, '#04331c'); g.addColorStop(1, '#000');
    } else if (S.realm === 'odin') {
      g = x.createLinearGradient(w, 0, 0, h); g.addColorStop(0, '#3a2a10'); g.addColorStop(0.35, '#151c33'); g.addColorStop(1, '#070a18');
    } else {
      g = x.createRadialGradient(w / 2, h * 0.47, 0, w / 2, h / 2, Math.max(w, h) * 0.7); g.addColorStop(0, 'rgba(0,40,22,0)'); g.addColorStop(1, 'rgba(0,0,0,0.6)');
    }
    x.fillStyle = g; x.fillRect(0, 0, w, h);
    // grain — a few hundred dots, cheap, done once
    x.fillStyle = rgba(P.main, 0.08);
    for (var i = 0; i < 400; i++) x.fillRect((rnd() * w) | 0, (rnd() * h) | 0, 1, 1);
  }

  // ---------------------------------------------------------------------------
  // GL backdrop — one program per realm, GLSL ES 1.00 so it runs on WebGL1 too
  // ---------------------------------------------------------------------------
  var VS = 'attribute vec2 p;varying vec2 v;void main(){v=p*0.5+0.5;gl_Position=vec4(p,0.,1.);}';
  var NOISE = [
    'precision mediump float;varying vec2 v;',
    'uniform vec2 R;uniform float T;uniform float uListen;uniform float uThink;uniform float uSpeak;uniform float uLevel;',
    'uniform float uCharge;uniform float uFlash;uniform float uIgnite;uniform float uHeat;uniform float uPulse;',
    'float hash(vec2 p){p=fract(p*vec2(123.34,456.21));p+=dot(p,p+45.32);return fract(p.x*p.y);}',
    'float vnoise(vec2 p){vec2 i=floor(p);vec2 f=fract(p);f=f*f*(3.-2.*f);',
    ' return mix(mix(hash(i),hash(i+vec2(1.,0.)),f.x),mix(hash(i+vec2(0.,1.)),hash(i+vec2(1.,1.)),f.x),f.y);}',
    'float fbm(vec2 p){float a=0.5,s=0.;for(int i=0;i<5;i++){s+=a*vnoise(p);p=p*2.03+vec2(17.1,9.7);a*=0.5;}return s;}'
  ].join('\n');
  var FRAG = {
    thor: NOISE + [
      'void main(){vec2 uv=v;float asp=R.x/R.y;vec2 c=vec2((uv.x-0.5)*asp,uv.y-0.5);',
      // listening: clouds lean toward the centre
      ' vec2 lean=c*(-0.18*uListen);',
      ' vec2 q=vec2(uv.x*asp,uv.y)*2.2+lean;',
      ' float t=T*0.05;',
      ' float n1=fbm(q+vec2(t,t*0.3));float n2=fbm(q*1.9-vec2(t*0.7,t*0.2)+n1*1.4);',
      ' float cloud=smoothstep(0.35,0.85,n1*0.6+n2*0.6);',
      ' vec3 sky=mix(vec3(0.015,0.03,0.07),vec3(0.05,0.10,0.22),uv.y);',
      ' vec3 cl=mix(vec3(0.05,0.08,0.16),vec3(0.35,0.45,0.65),cloud);',
      // internal light: charge building behind the clouds while thinking, flash on strike
      ' float core=exp(-dot(c,c)*3.5);',
      ' float inner=uCharge*core*(0.8+0.2*sin(T*7.));',
      ' cl+=vec3(0.45,0.55,0.9)*inner*cloud+vec3(0.9,0.95,1.)*uFlash*(0.4+0.6*cloud);',
      ' cl+=vec3(1.,0.85,0.45)*uIgnite*core*1.5;',
      ' vec3 col=mix(sky,cl,cloud*0.95);',
      ' col*=1.0-0.55*smoothstep(0.5,1.2,length(c));',
      ' gl_FragColor=vec4(col,1.);}'
    ].join('\n'),
    loki: NOISE + [
      'void main(){vec2 uv=v;float asp=R.x/R.y;vec2 c=vec2((uv.x-0.5)*asp,uv.y-0.5);',
      ' vec2 q=vec2(uv.x*asp,uv.y)*1.8;float t=T*0.07;',
      ' float n=fbm(q+vec2(t*0.6,-t*0.25));float n2=fbm(q*2.3+vec2(-t*0.4,t*0.5)+n);',
      ' float mist=smoothstep(0.3,0.9,n*0.55+n2*0.55);',
      // listening: the mist parts around the centre
      ' float part=smoothstep(0.15,0.55+0.3*uListen,length(c))*(1.0-uListen)+uListen*smoothstep(0.35,0.9,length(c));',
      ' mist*=mix(1.,part,0.85*uListen+0.15);',
      ' vec3 base=mix(vec3(0.0,0.0,0.0),vec3(0.01,0.09,0.05),smoothstep(0.0,0.45,uv.y));',
      ' vec3 em=vec3(0.06,0.55,0.28);vec3 gold=vec3(0.75,0.6,0.18);',
      ' vec3 m=mix(em,gold,smoothstep(0.55,0.95,n2)*0.5);',
      // horizon glow, green-black
      ' float hz=exp(-abs(uv.y-0.42)*9.)*0.5;',
      ' vec3 col=base+m*mist*0.55+em*hz;',
      ' float core=exp(-dot(c,c)*4.);',
      ' col+=vec3(0.2,0.9,0.5)*core*(uCharge*0.6+uSpeak*uPulse*0.9)+vec3(1.,0.9,0.5)*uIgnite*core;',
      ' col+=vec3(0.9,1.,0.95)*uFlash*0.35;',
      ' col*=1.0-0.5*smoothstep(0.55,1.25,length(c));',
      ' gl_FragColor=vec4(col,1.);}'
    ].join('\n'),
    odin: NOISE + [
      'void main(){vec2 uv=v;float asp=R.x/R.y;vec2 c=vec2((uv.x-0.5)*asp,uv.y-0.5);',
      // low slanted sun, top-right; ignite = sunrise (sun lifts from below the frame)
      ' vec2 sunP=vec2(0.42*asp,-0.35+0.55*uIgnite+0.02*sin(T*0.3));',
      ' vec2 d=c-sunP;float sd=length(d);',
      ' float sun=exp(-sd*sd*9.)*(1.0+uSpeak*uLevel*1.2+uFlash*2.);',
      ' float ang=atan(d.y,d.x);',
      ' float rays=fbm(vec2(ang*3.0,sd*0.8-T*0.05))*smoothstep(1.6,0.1,sd);',
      ' rays=pow(rays,2.2)*0.9;',
      ' vec3 navy=mix(vec3(0.02,0.03,0.08),vec3(0.06,0.09,0.2),uv.y);',
      ' vec3 gold=vec3(1.0,0.78,0.3);vec3 bone=vec3(0.95,0.93,0.86);',
      ' float dust=fbm(vec2(uv.x*asp*3.,uv.y*3.)+vec2(T*0.03,-T*0.02))*0.35;',
      ' vec3 col=navy+gold*(sun*1.3+rays*(0.35+0.4*uIgnite+0.2*uSpeak))+gold*dust*0.35*(0.6+0.4*uListen);',
      ' col=mix(col,bone,uFlash*0.4);',
      ' float core=exp(-dot(c,c)*4.);col+=gold*core*uCharge*0.45;',
      ' col*=1.0-0.5*smoothstep(0.6,1.3,length(c));',
      ' gl_FragColor=vec4(col,1.);}'
    ].join('\n'),
    hela: NOISE + [
      'void main(){vec2 uv=v;float asp=R.x/R.y;vec2 c=vec2((uv.x-0.5)*asp,uv.y-0.5);',
      // smoke tendrils crawling in from the edges; heat lifts them red
      ' float t=T*(0.06+0.12*uHeat);',
      ' vec2 q=vec2(uv.x*asp,uv.y)*2.6;',
      ' float n=fbm(q+vec2(t*0.5,t*0.9));float n2=fbm(q*1.7-vec2(t*0.3,t*0.6)+n*1.2);',
      ' float edge=1.0-smoothstep(0.0,0.55,min(min(uv.x,1.-uv.x)*asp,min(uv.y,1.-uv.y))*1.6);',
      ' float smoke=smoothstep(0.35,0.95,n*0.6+n2*0.55)*edge;',
      ' vec3 g=vec3(0.0,0.35,0.16);vec3 r=vec3(0.45,0.03,0.02);vec3 tone=mix(g,r,uHeat);',
      ' float pulse=0.5+0.5*sin(T*0.9)*uPulse;',
      ' vec3 col=tone*smoke*(0.6+0.3*pulse)+vec3(0.,0.,0.)*0.;',
      ' float core=exp(-dot(c,c)*3.);col+=tone*core*0.12*pulse;',
      ' col+=mix(vec3(0.3,1.,0.6),vec3(1.,0.4,0.3),uHeat)*uFlash*0.3;',
      ' float a=clamp(smoke*0.9+core*0.15*pulse+uFlash*0.25,0.,1.);',
      ' gl_FragColor=vec4(col,a);}'
    ].join('\n')
  };
  var progs = {}, quad = null, uni = {};
  function compile(type, src) {
    var sh = gl.createShader(type); gl.shaderSource(sh, src); gl.compileShader(sh);
    if (!gl.getShaderParameter(sh, gl.COMPILE_STATUS)) { var log = gl.getShaderInfoLog(sh); gl.deleteShader(sh); throw new Error('shader: ' + log); }
    return sh;
  }
  function buildPrograms() {
    progs = {}; uni = {};
    quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    var vs = compile(gl.VERTEX_SHADER, VS);
    for (var k in FRAG) {
      var p = gl.createProgram(); gl.attachShader(p, vs); gl.attachShader(p, compile(gl.FRAGMENT_SHADER, FRAG[k])); gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('link ' + k + ': ' + gl.getProgramInfoLog(p));
      progs[k] = p; uni[k] = {};
      ['R', 'T', 'uListen', 'uThink', 'uSpeak', 'uLevel', 'uCharge', 'uFlash', 'uIgnite', 'uHeat', 'uPulse'].forEach(function (n) { uni[k][n] = gl.getUniformLocation(p, n); });
      uni[k].p = gl.getAttribLocation(p, 'p');
    }
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
  }
  function initGL() {
    glCanvas = document.createElement('canvas');
    var opts = { alpha: true, antialias: false, depth: false, stencil: false, premultipliedAlpha: true, preserveDrawingBuffer: false, powerPreference: 'low-power' };
    gl = null;
    try { gl = glCanvas.getContext('webgl2', opts); if (gl) glVer = 2; } catch (e) { gl = null; }
    if (!gl) { try { gl = glCanvas.getContext('webgl', opts) || glCanvas.getContext('experimental-webgl', opts); if (gl) glVer = 1; } catch (e) { gl = null; } }
    if (!gl) { S.renderPath = '2D-ONLY'; return; }
    // a second GL context next to the reactor's is exactly where loss happens
    glCanvas.addEventListener('webglcontextlost', function (e) { e.preventDefault(); S.glLost = true; S.renderPath = 'GL-LOST/2D'; }, false);
    glCanvas.addEventListener('webglcontextrestored', function () {
      try { buildPrograms(); gl.viewport(0, 0, glCanvas.width, glCanvas.height); S.glLost = false; S.renderPath = 'WEBGL' + glVer + '/2D'; }
      catch (e) { S.glLost = true; S.renderPath = 'GL-LOST/2D'; }
    }, false);
    try { buildPrograms(); S.renderPath = 'WEBGL' + glVer + '/2D'; }
    catch (e) { gl = null; S.renderPath = '2D-ONLY'; if (DEBUG) console.warn('[AsgardFX]', e.message); }
  }
  var pulsePhase = 0;
  function drawShader(realm) {
    var p = progs[realm], u = uni[realm];
    if (!p) return false;
    gl.useProgram(p);
    gl.bindBuffer(gl.ARRAY_BUFFER, quad);
    gl.enableVertexAttribArray(u.p); gl.vertexAttribPointer(u.p, 2, gl.FLOAT, false, 0, 0);
    gl.uniform2f(u.R, glCanvas.width, glCanvas.height);
    gl.uniform1f(u.T, S.t);
    gl.uniform1f(u.uListen, S.listenW); gl.uniform1f(u.uThink, S.thinkW); gl.uniform1f(u.uSpeak, S.speakW);
    gl.uniform1f(u.uLevel, S.levelSmooth); gl.uniform1f(u.uCharge, S.charge); gl.uniform1f(u.uFlash, S.flash);
    gl.uniform1f(u.uIgnite, S.ignite); gl.uniform1f(u.uHeat, S.heat); gl.uniform1f(u.uPulse, pulsePhase);
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    return true;
  }

  // ---------------------------------------------------------------------------
  // particles — one pooled struct-of-arrays, no per-frame allocation
  // kind: 0 rain 1 rune 2 dust 3 ember 4 bird 5 antler 6 trail 7 spark 8 mote
  // ---------------------------------------------------------------------------
  var MAXP = 1400;
  var P = {
    n: MAXP, alive: new Uint8Array(MAXP), kind: new Uint8Array(MAXP),
    x: new Float32Array(MAXP), y: new Float32Array(MAXP), vx: new Float32Array(MAXP), vy: new Float32Array(MAXP),
    life: new Float32Array(MAXP), max: new Float32Array(MAXP), size: new Float32Array(MAXP), depth: new Float32Array(MAXP),
    seed: new Float32Array(MAXP), cursor: 0, count: 0
  };
  var budget = { thor: 700, loki: 220, odin: 320, hela: 260 };
  function spawn(kind, x, y, vx, vy, life, size, depth) {
    var cap = particleCap();
    if (P.count >= cap) return -1;
    for (var tries = 0; tries < MAXP; tries++) {
      var i = P.cursor; P.cursor = (P.cursor + 1) % MAXP;
      if (!P.alive[i]) {
        P.alive[i] = 1; P.kind[i] = kind; P.x[i] = x; P.y[i] = y; P.vx[i] = vx; P.vy[i] = vy;
        P.life[i] = 0; P.max[i] = life; P.size[i] = size; P.depth[i] = depth; P.seed[i] = rnd() * 6.283;
        P.count++; return i;
      }
    }
    return -1;
  }
  function particleCap() { var b = budget[S.realm] || 300; if (S.tier >= 1) b >>= 1; if (S.tier >= 4) b >>= 2; return Math.min(MAXP, b + 200); }
  function killAll() { for (var i = 0; i < MAXP; i++) P.alive[i] = 0; P.count = 0; }
  function layoutParticles() { killAll(); if (!REDUCED) for (var i = 0; i < 40; i++) ambient(1); }

  // steady-state population per realm; `boost` seeds a burst
  var birdTimer = 12, sheetTimer = 8;
  function ambient(boost) {
    var w = S.w, h = S.h, cap = particleCap() - 200, r = S.realm, k;
    if (r === 'thor') {
      // three depth layers of rain, slowed while thinking
      var want = cap, per = 1 + boost * 6;
      for (k = 0; k < per && P.count < want; k++) { var d = rnd(); spawn(0, rr(-0.1, 1.1) * w, -20, (-60 - 120 * d) * (1 - 0.7 * S.thinkW), (520 + 620 * d) * (1 - 0.7 * S.thinkW), 3, 1 + d * 1.5, d); }
    } else if (r === 'loki') {
      if (P.count < cap && rnd() < 0.35 + boost) { var dd = rnd(); spawn(1, rr(0, 1) * w, rr(0, 1) * h, rr(-6, 6), rr(-14, -4) * (0.4 + dd), rr(9, 16), 6 + dd * 12, dd); }
      if (P.count < cap && rnd() < 0.5) spawn(3, rr(0, 1) * w, h + 10, rr(-8, 8), rr(-40, -15), rr(4, 8), rr(1, 2.4), rnd());
    } else if (r === 'odin') {
      if (P.count < cap && rnd() < 0.7 + boost * 3) { var d3 = rnd(); spawn(2, rr(0, 1) * w, rr(0, 1) * h, rr(-9, -2) * (0.4 + d3), rr(-3, 3), rr(10, 18), 0.8 + d3 * 1.8, d3); }
      birdTimer -= S.dt; if (birdTimer <= 0) { birdTimer = rr(20, 40); var dir = rnd() < 0.5 ? 1 : -1, y0 = rr(0.1, 0.45) * h, sp = rr(40, 70) * dir; for (k = 0; k < 3 + (rnd() * 4 | 0); k++) spawn(4, (dir > 0 ? -60 : w + 60) - dir * k * rr(25, 45), y0 + rr(-18, 18), sp, rr(-4, 4), (w + 160) / Math.abs(sp), rr(4, 7), 0.5); }
    } else {
      if (P.count < cap && rnd() < 0.6 + boost * 2) spawn(S.heat > 0.5 ? 7 : 3, rr(0, 1) * w, h + 10, rr(-12, 12), rr(-70, -25) * (1 + S.heat), rr(5, 9), rr(1, 2.6), rnd());
      if (P.count < cap && rnd() < 0.02) spawn(5, rr(0.1, 0.9) * w, rr(0.05, 0.6) * h, rr(-4, 4), rr(-2, 2), rr(14, 22), rr(60, 140), 0.1);
    }
  }
  function trailSpawn(x, y, vx, vy) {
    var r = S.realm, c = 3 + (S.tier < 1 ? 2 : 0);
    for (var k = 0; k < c; k++) {
      if (r === 'thor') spawn(6, x + rr(-3, 3), y + rr(-3, 3), rr(-30, 30) - vx * 0.05, rr(-30, 30) - vy * 0.05, rr(0.15, 0.35), rr(4, 14), 1);
      else if (r === 'loki') spawn(3, x, y, rr(-25, 25), rr(-60, -10), rr(0.5, 1.1), rr(1, 2.2), 1);
      else if (r === 'odin') spawn(8, x, y, rr(-12, 12), rr(-20, 5), rr(0.7, 1.4), rr(1, 2.4), 1);
      else spawn(S.heat > 0.5 ? 7 : 3, x, y, rr(-20, 20), rr(-50, -5), rr(0.4, 0.9), rr(1, 2), 1);
    }
  }
  var wind = 0;
  function stepParticles(dt) {
    wind = Math.sin(S.t * 0.4) * 30 + S.listenW * 20;
    var cx = S.w / 2, cy = S.h / 2, inward = S.listenW * 18;
    for (var i = 0; i < MAXP; i++) {
      if (!P.alive[i]) continue;
      P.life[i] += dt;
      var k = P.kind[i];
      if (P.life[i] >= P.max[i] || P.y[i] > S.h + 40 || P.x[i] < -200 || P.x[i] > S.w + 200 || (k !== 0 && P.y[i] < -60)) { P.alive[i] = 0; P.count--; continue; }
      if (k === 0) { P.x[i] += (P.vx[i] + wind * P.depth[i]) * dt; P.y[i] += P.vy[i] * dt; }
      else if (k === 1) { P.x[i] += (P.vx[i] + Math.sin(S.t + P.seed[i]) * 6) * dt + (cx - P.x[i]) * (S.thinkW * 0.6 + S.listenW * 0.05) * dt; P.y[i] += P.vy[i] * dt + (cy - P.y[i]) * S.thinkW * 0.6 * dt; }
      else if (k === 2) { P.x[i] += (P.vx[i] + Math.sin(S.t * 0.7 + P.seed[i]) * 4) * dt + (cx - P.x[i]) * inward * 0.01 * dt; P.y[i] += (P.vy[i] + Math.cos(S.t * 0.5 + P.seed[i]) * 4) * dt + (cy - P.y[i]) * inward * 0.01 * dt; }
      else if (k === 3 || k === 7 || k === 8) { P.x[i] += (P.vx[i] + Math.sin(S.t * 2 + P.seed[i]) * 8) * dt; P.y[i] += P.vy[i] * dt; P.vy[i] += (k === 8 ? 6 : -4) * dt; }
      else if (k === 4) { P.x[i] += P.vx[i] * dt; P.y[i] += (P.vy[i] + Math.sin(S.t * 3 + P.seed[i]) * 3) * dt; }
      else if (k === 5) { P.x[i] += P.vx[i] * dt; P.y[i] += P.vy[i] * dt; }
      else if (k === 6) { P.x[i] += P.vx[i] * dt; P.y[i] += P.vy[i] * dt; }
    }
  }
  var col0 = [0, 0, 0];
  function drawParticles(ctx, layer /* 0 back, 1 over */) {
    var dpr = S.dpr, Pl = PALETTE[S.realm], heatCol = [255, 60, 40];
    ctx.save(); ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    for (var i = 0; i < MAXP; i++) {
      if (!P.alive[i]) continue;
      var k = P.kind[i], onOver = (k === 6 || (k === 7 && P.depth[i] === 1) || (k === 3 && P.depth[i] === 1) || (k === 8 && P.depth[i] === 1));
      if ((layer === 1) !== onOver) continue;
      var x = P.x[i], y = P.y[i], lf = P.life[i] / P.max[i], fade = lf < 0.1 ? lf * 10 : lf > 0.8 ? (1 - lf) * 5 : 1, d = P.depth[i], s = P.size[i];
      if (k === 0) {
        ctx.strokeStyle = 'rgba(170,200,255,' + (0.08 + d * 0.28) * fade + ')'; ctx.lineWidth = s * 0.6;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - (P.vx[i] + wind * d) * 0.03, y - P.vy[i] * 0.03); ctx.stroke();
      } else if (k === 1) {
        drawRune(ctx, x, y, s, P.seed[i], (0.12 + d * 0.5) * fade, d > 0.6 ? Pl.edge : Pl.main);
      } else if (k === 2) {
        ctx.fillStyle = rgba(Pl.main, (0.15 + d * 0.5) * fade); ctx.beginPath(); ctx.arc(x, y, s, 0, 6.283); ctx.fill();
      } else if (k === 3 || k === 7 || k === 8) {
        var c = k === 7 ? heatCol : (S.realm === 'hela' ? mix3(Pl.main, heatCol, S.heat, col0) : (k === 8 ? Pl.main : Pl.trail));
        ctx.fillStyle = rgba(c, (0.35 + d * 0.5) * fade); ctx.beginPath(); ctx.arc(x, y, s, 0, 6.283); ctx.fill();
        if (k === 7 && lf < 0.5) { ctx.strokeStyle = rgba(c, 0.5 * fade); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - P.vx[i] * 0.04, y - P.vy[i] * 0.04); ctx.stroke(); }
      } else if (k === 4) {
        // far bird — two strokes, wingbeat from seed
        var wb = Math.sin(S.t * 9 + P.seed[i]) * s * 0.6, dir = P.vx[i] > 0 ? 1 : -1;
        ctx.strokeStyle = 'rgba(10,8,20,' + 0.7 * fade + ')'; ctx.lineWidth = 1.2;
        ctx.beginPath(); ctx.moveTo(x - s * dir, y - wb); ctx.lineTo(x, y); ctx.lineTo(x + s * dir, y - wb); ctx.stroke();
      } else if (k === 5) {
        drawAntler(ctx, x, y, s, P.seed[i], 0.09 * fade * (0.6 + 0.4 * Math.sin(S.t * 0.8 + P.seed[i])));
      } else if (k === 6) {
        // micro-lightning: a jagged 3-segment stroke
        ctx.strokeStyle = 'rgba(200,225,255,' + 0.9 * fade + ')'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(x, y);
        var a = P.seed[i], L = s;
        ctx.lineTo(x + Math.cos(a) * L * 0.4, y + Math.sin(a) * L * 0.4); ctx.lineTo(x + Math.cos(a + 0.7) * L * 0.7, y + Math.sin(a + 0.7) * L * 0.7); ctx.lineTo(x + Math.cos(a) * L, y + Math.sin(a) * L);
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  // simple runic strokes — 3 to 5 straight segments on a vertical stem
  function drawRune(ctx, x, y, s, seed, a, col) {
    ctx.strokeStyle = rgba(col, a); ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x, y + s);
    var n = 2 + ((seed * 10) | 0) % 3;
    for (var i = 0; i < n; i++) { var yy = y - s + (2 * s * (i + 0.5)) / n, dir = Math.sin(seed * (i + 3)) > 0 ? 1 : -1; ctx.moveTo(x, yy); ctx.lineTo(x + dir * s * 0.55, yy - s * 0.35 * dir); }
    ctx.stroke();
  }
  // antler-like silhouette — branching lines, kept abstract
  function drawAntler(ctx, x, y, s, seed, a) {
    ctx.strokeStyle = 'rgba(0,0,0,' + a + ')'; ctx.lineWidth = 2.5;
    for (var side = -1; side <= 1; side += 2) {
      ctx.beginPath(); ctx.moveTo(x, y + s * 0.5);
      var px = x, py = y + s * 0.5, ang = -1.57 + side * 0.5;
      for (var i = 0; i < 4; i++) { var L = s * (0.35 - i * 0.05); px += Math.cos(ang) * L; py += Math.sin(ang) * L; ctx.lineTo(px, py); ang += side * (0.35 + 0.2 * Math.sin(seed + i)); ctx.moveTo(px, py); ctx.lineTo(px + Math.cos(ang - side * 1.2) * L * 0.6, py + Math.sin(ang - side * 1.2) * L * 0.6); ctx.moveTo(px, py); }
      ctx.stroke();
    }
  }

  // ---------------------------------------------------------------------------
  // overlay effects — every one of these has a hard time backstop
  // ---------------------------------------------------------------------------
  var BOLTS = []; for (var bi = 0; bi < 6; bi++) BOLTS.push({ on: 0, t: 0, max: 0.35, pts: new Float32Array(2 * 64), n: 0, forks: [], power: 1 });
  function buildBoltPath(pts, x0, y0, x1, y1, jag) {
    var n = 0, segs = 22; pts[n++] = x0; pts[n++] = y0;
    var dx = x1 - x0, dy = y1 - y0, len = Math.sqrt(dx * dx + dy * dy) || 1, nx = -dy / len, ny = dx / len;
    for (var i = 1; i < segs; i++) { var t = i / segs, off = (rnd() - 0.5) * jag * len * Math.sin(t * 3.1416); pts[n++] = x0 + dx * t + nx * off; pts[n++] = y0 + dy * t + ny * off; }
    pts[n++] = x1; pts[n++] = y1; return n >> 1;
  }
  function strike(power, x1, y1) {
    var b = null; for (var i = 0; i < BOLTS.length; i++) if (!BOLTS[i].on) { b = BOLTS[i]; break; }
    if (!b) return;
    var w = S.w, h = S.h, x0 = rr(0.15, 0.85) * w, y0 = -10;
    if (x1 === undefined) { x1 = w / 2 + rr(-0.25, 0.25) * w; y1 = rr(0.35, 0.75) * h; }
    b.on = 1; b.t = 0; b.power = power; b.max = 0.22 + power * 0.25;
    b.n = buildBoltPath(b.pts, x0, y0, x1, y1, 0.16);
    b.forks.length = 0;
    var nf = 2 + ((rnd() * 3) | 0);
    for (var f = 0; f < nf; f++) {
      var at = 4 + ((rnd() * (b.n - 8)) | 0), fx0 = b.pts[at * 2], fy0 = b.pts[at * 2 + 1];
      var fp = new Float32Array(2 * 24), fn = buildBoltPath(fp, fx0, fy0, fx0 + rr(-0.2, 0.2) * w, fy0 + rr(0.08, 0.25) * h, 0.22);
      b.forks.push({ pts: fp, n: fn });
    }
    S.flash = Math.max(S.flash, 0.35 + power * 0.65); S.flashCol = [230, 240, 255];
    sfx.thunder(power);
  }
  function strokePath(ctx, pts, n) { ctx.beginPath(); ctx.moveTo(pts[0], pts[1]); for (var i = 1; i < n; i++) ctx.lineTo(pts[i * 2], pts[i * 2 + 1]); ctx.stroke(); }
  function drawBolts(ctx) {
    for (var i = 0; i < BOLTS.length; i++) {
      var b = BOLTS[i]; if (!b.on) continue;
      b.t += S.dt; if (b.t >= b.max) { b.on = 0; continue; }
      var k = 1 - b.t / b.max, flick = 0.7 + 0.3 * Math.sin(b.t * 90), a = k * flick;
      var passes = [[14, 'rgba(90,140,255,' + a * 0.25 + ')'], [6, 'rgba(150,190,255,' + a * 0.6 + ')'], [2.5, 'rgba(225,235,255,' + a + ')'], [1, 'rgba(255,255,255,' + a + ')']];
      for (var p = 0; p < passes.length; p++) {
        ctx.lineWidth = passes[p][0] * (0.7 + b.power * 0.5); ctx.strokeStyle = passes[p][1];
        strokePath(ctx, b.pts, b.n);
        if (p > 0) for (var f = 0; f < b.forks.length; f++) { ctx.lineWidth *= 0.6; strokePath(ctx, b.forks[f].pts, b.forks[f].n); }
      }
    }
  }
  var RINGS = []; for (var ri = 0; ri < 8; ri++) RINGS.push({ on: 0, t: 0, max: 1.2, r0: 0, power: 1 });
  function ring(power) { for (var i = 0; i < RINGS.length; i++) if (!RINGS[i].on) { RINGS[i].on = 1; RINGS[i].t = 0; RINGS[i].power = power; RINGS[i].max = 0.9 + power * 0.6; return; } }
  function drawRings(ctx) {
    var cx = S.w / 2, cy = S.h / 2, Pl = PALETTE[S.realm];
    for (var i = 0; i < RINGS.length; i++) {
      var r = RINGS[i]; if (!r.on) continue;
      r.t += S.dt; if (r.t >= r.max) { r.on = 0; continue; }
      var k = r.t / r.max, rad = 60 + k * Math.max(S.w, S.h) * 0.75, a = (1 - k) * (1 - k) * (0.35 + 0.5 * r.power);
      ctx.lineWidth = 2 + (1 - k) * 10 * r.power; ctx.strokeStyle = rgba(Pl.main, a); ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 6.283); ctx.stroke();
      ctx.lineWidth = 1; ctx.strokeStyle = rgba(Pl.hot, a * 0.7); ctx.beginPath(); ctx.arc(cx, cy, rad * 0.97, 0, 6.283); ctx.stroke();
    }
  }
  // thinking visuals drawn on the backdrop, behind the form
  function drawIris(ctx) { // odin — one ring closing toward the centre
    var k = S.thinkW; if (k < 0.02) return;
    var cx = S.w / 2, cy = S.h / 2, rmax = Math.min(S.w, S.h) * 0.62, phase = (S.t * 0.12) % 1, rad = rmax * (1 - phase) + 20;
    ctx.strokeStyle = 'rgba(255,205,90,' + 0.35 * k * (1 - phase) + ')'; ctx.lineWidth = 1.5 + phase * 3;
    ctx.beginPath(); ctx.arc(cx, cy, rad, 0, 6.283); ctx.stroke();
    ctx.strokeStyle = 'rgba(246,244,236,' + 0.12 * k + ')'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(cx, cy, rmax * 0.55, rmax * 0.22, 0, 0, 6.283); ctx.stroke();
  }
  var sigilShatter = 0;
  function drawSigil(ctx) { // loki — runes converge into a slow-turning sigil
    var k = Math.max(S.thinkW, sigilShatter); if (k < 0.02) return;
    var cx = S.w / 2, cy = S.h / 2, R = Math.min(S.w, S.h) * (0.22 + sigilShatter * 0.5), rot = S.t * 0.25;
    ctx.save(); ctx.translate(cx, cy); ctx.rotate(rot);
    ctx.strokeStyle = 'rgba(60,220,120,' + 0.45 * k * (1 - sigilShatter) + ')'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, 6.283); ctx.stroke();
    ctx.beginPath(); for (var i = 0; i < 7; i++) { var a = i * 6.283 / 7, a2 = ((i + 3) % 7) * 6.283 / 7; ctx.moveTo(Math.cos(a) * R, Math.sin(a) * R); ctx.lineTo(Math.cos(a2) * R, Math.sin(a2) * R); } ctx.stroke();
    ctx.strokeStyle = 'rgba(255,199,64,' + 0.35 * k + ')';
    for (var j = 0; j < 7; j++) { var aa = j * 6.283 / 7; drawRune(ctx, Math.cos(aa) * R * 1.12, Math.sin(aa) * R * 1.12, 7, j * 1.7, 0.5 * k, PALETTE.loki.edge); }
    ctx.restore();
  }
  function drawStaticCharge(ctx) { // thor listening — arcs crawling on the ring
    var k = S.listenW; if (k < 0.05 || S.tier >= 4) return;
    var cx = S.w / 2, cy = S.h / 2, R = Math.min(S.w, S.h) * 0.31;
    ctx.strokeStyle = 'rgba(190,215,255,' + 0.7 * k + ')'; ctx.lineWidth = 1;
    var n = 3 + (k * 4 | 0);
    for (var i = 0; i < n; i++) {
      if (rnd() > 0.35) continue;
      var a = rnd() * 6.283, len = rr(0.15, 0.5);
      ctx.beginPath(); ctx.moveTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R);
      for (var s = 1; s <= 4; s++) { var aa = a + len * s / 4, rr2 = R + rr(-6, 6); ctx.lineTo(cx + Math.cos(aa) * rr2, cy + Math.sin(aa) * rr2); }
      ctx.stroke();
    }
  }
  var slipT = 0;
  function drawTimeSlips(ctx) { // loki thinking — green scanline flickers
    if (S.thinkW < 0.1 || S.tier >= 4) return;
    slipT -= S.dt; if (slipT > 0) return; slipT = rr(0.12, 0.6);
    var y = rnd() * S.h, hgt = rr(2, 14);
    ctx.fillStyle = 'rgba(60,255,140,' + rr(0.05, 0.16) * S.thinkW + ')'; ctx.fillRect(0, y, S.w, hgt);
    ctx.fillStyle = 'rgba(0,0,0,0.25)'; ctx.fillRect(0, y + hgt, S.w, 1);
  }
  var shardT = 0, lastReplyEl = null;
  function drawShards(ctx) { // loki speaking — mirror-shard copies of the transcript for a frame
    if (S.speakW < 0.3 || !lastReplyEl || S.tier >= 3) return;
    shardT -= S.dt; if (shardT > 0) return; shardT = rr(0.25, 0.9) / (0.5 + S.levelSmooth);
    var r; try { r = lastReplyEl.getBoundingClientRect(); } catch (e) { return; }
    if (!r || r.width < 10 || r.bottom < 0 || r.top > S.h) return;
    var txt = (lastReplyEl.textContent || '').slice(0, 90);
    ctx.save(); ctx.font = '11px monospace'; ctx.textBaseline = 'top';
    for (var i = 0; i < 3; i++) {
      var ox = rr(-40, 40), oy = rr(-14, 14), sk = rr(-0.25, 0.25);
      ctx.setTransform(S.dpr, 0, sk * S.dpr, S.dpr, (r.left + ox) * S.dpr, (r.top + 14 + oy) * S.dpr);
      ctx.fillStyle = 'rgba(120,255,180,' + rr(0.15, 0.45) + ')'; ctx.fillText(txt, 0, 0);
    }
    ctx.restore();
  }
  function drawWipe(ctx) { // 600 ms diagonal light-slice; old realm dissolves, new one ignites
    if (S.wipe <= 0 || S.wipe >= 1) return;
    var Pl = PALETTE[S.realm], w = S.w, h = S.h, k = S.wipe, pos = (k * 1.6 - 0.3) * (w + h);
    ctx.save(); ctx.translate(pos, 0); ctx.transform(1, 0, -0.55, 1, 0, 0);
    var g = ctx.createLinearGradient(-90, 0, 90, 0);
    g.addColorStop(0, rgba(Pl.main, 0)); g.addColorStop(0.45, rgba(Pl.hot, 0.85)); g.addColorStop(0.55, rgba(Pl.hot, 0.9)); g.addColorStop(1, rgba(Pl.main, 0));
    ctx.fillStyle = g; ctx.fillRect(-90, -10, 180, h + 20);
    ctx.restore();
    ctx.fillStyle = rgba(Pl.main, 0.18 * Math.sin(k * 3.1416)); ctx.fillRect(0, 0, w, h);
  }
  function drawDrain(ctx) { // vault close — everything leaves out the bottom in 700 ms
    if (S.drain <= 0) return;
    var k = 1 - S.drain, y = k * k * S.h, c = mix3(PALETTE.hela.main, [255, 60, 40], S.heat, col0);
    var g = ctx.createLinearGradient(0, y, 0, S.h);
    g.addColorStop(0, rgba(c, 0)); g.addColorStop(0.3, rgba(c, 0.35 * S.drain)); g.addColorStop(1, 'rgba(0,0,0,' + 0.85 * S.drain + ')');
    ctx.fillStyle = g; ctx.fillRect(0, y, S.w, S.h - y);
  }

  // ---------------------------------------------------------------------------
  // micro-SFX — synthesized, silent until the first user gesture
  // ---------------------------------------------------------------------------
  var sfx = (function () {
    var ac = null, master = null, hum = null, humGain = null, unlocked = false, noiseBuf = null;
    function ctx() {
      if (!unlocked) return null;
      if (!ac) { try { ac = new (window.AudioContext || window.webkitAudioContext)(); master = ac.createGain(); master.gain.value = S.muted ? 0 : 0.5; master.connect(ac.destination); } catch (e) { return null; } }
      if (ac.state === 'suspended') ac.resume().catch(function () {});
      return ac;
    }
    function noise() { if (noiseBuf) return noiseBuf; var b = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate), d = b.getChannelData(0); for (var i = 0; i < d.length; i++) d[i] = rnd() * 2 - 1; noiseBuf = b; return b; }
    function tone(f0, f1, dur, type, g, delay) {
      var a = ctx(); if (!a) return; var t = a.currentTime + (delay || 0);
      var o = a.createOscillator(), gn = a.createGain(); o.type = type || 'sine';
      o.frequency.setValueAtTime(f0, t); o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
      gn.gain.setValueAtTime(0.0001, t); gn.gain.exponentialRampToValueAtTime(g, t + 0.01); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(gn); gn.connect(master); o.start(t); o.stop(t + dur + 0.05);
    }
    function burst(dur, cutoff, g, q) {
      var a = ctx(); if (!a) return; var t = a.currentTime;
      var s = a.createBufferSource(); s.buffer = noise(); var f = a.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(cutoff, t); f.frequency.exponentialRampToValueAtTime(60, t + dur); f.Q.value = q || 0.7;
      var gn = a.createGain(); gn.gain.setValueAtTime(g, t); gn.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      s.connect(f); f.connect(gn); gn.connect(master); s.start(t); s.stop(t + dur + 0.05);
    }
    return {
      unlock: function () { if (unlocked) return; unlocked = true; ctx(); },
      send: function () { tone(520, 980, 0.09, 'triangle', 0.12); },
      receive: function () { tone(660, 440, 0.16, 'sine', 0.1); tone(990, 880, 0.2, 'sine', 0.05, 0.06); },
      error: function () { tone(220, 110, 0.25, 'sawtooth', 0.08); },
      wake: function (realm) { var base = realm === 'odin' ? 110 : realm === 'loki' ? 160 : 90; tone(base, base * 4, 0.9, 'sine', 0.16); burst(1.1, realm === 'thor' ? 900 : 400, 0.12); },
      swtch: function () { burst(0.45, 3200, 0.16, 2); tone(300, 1200, 0.3, 'triangle', 0.06); },
      thunder: function (p) { burst(0.7 + p * 1.6, 220 + p * 380, 0.25 + p * 0.45, 0.5); tone(55, 30, 0.8 + p, 'sine', 0.12 + p * 0.1); },
      vault: function (open) { tone(open ? 180 : 60, open ? 45 : 240, 1.3, 'sine', 0.14); },
      hum: function (on, realm) {
        var a = ctx(); if (!a) return;
        if (!on) { if (humGain) { humGain.gain.setTargetAtTime(0.0001, a.currentTime, 0.4); } return; }
        if (!hum) { hum = a.createOscillator(); hum.type = 'sine'; humGain = a.createGain(); humGain.gain.value = 0.0001; hum.connect(humGain); humGain.connect(master); hum.start(); }
        hum.frequency.setTargetAtTime(realm === 'odin' ? 65 : realm === 'loki' ? 82 : realm === 'hela' ? 41 : 49, a.currentTime, 0.3);
        humGain.gain.setTargetAtTime(0.035, a.currentTime, 0.6);
      },
      setMuted: function (m) { if (master) master.gain.setTargetAtTime(m ? 0 : 0.5, ac.currentTime, 0.05); }
    };
  })();

  // ---------------------------------------------------------------------------
  // speech level — the hall's Reactor.setAudioLevel is tapped if it exists;
  // otherwise a syllable-shaped envelope is synthesized while "speaking"
  // ---------------------------------------------------------------------------
  var reactorHooked = false, hookTries = 0;
  function hookReactor() {
    if (reactorHooked || !window.Reactor || typeof window.Reactor.setAudioLevel !== 'function') return;
    var orig = window.Reactor.setAudioLevel;
    window.Reactor.setAudioLevel = function (v) { try { feedLevel(v); } catch (e) {} return orig.apply(this, arguments); };
    reactorHooked = true;
  }
  function feedLevel(v) { S.level = clamp(+v || 0, 0, 1); S.levelExternal = true; S.lastExternalAt = performance.now(); }
  var syl = 0, sylAmp = 0.5;
  function updateLevel(dt, now) {
    var lv = 0;
    if (S.state === 'speaking') {
      if (S.levelExternal && now - S.lastExternalAt < 400) lv = S.level;
      else { syl -= dt; if (syl <= 0) { syl = rr(0.09, 0.26); sylAmp = rr(0.15, 0.95); } lv = sylAmp * (0.55 + 0.45 * Math.abs(Math.sin(now / 45))); }
    }
    S.levelSmooth += (lv - S.levelSmooth) * (lv > S.levelSmooth ? 0.45 : 0.1);
    S.levelAvg += (S.levelSmooth - S.levelAvg) * 0.03;
    S.peakCooldown -= dt;
    if (S.state === 'speaking' && S.peakCooldown <= 0 && S.levelSmooth > S.levelAvg * 1.3 + 0.12 && S.levelSmooth > 0.3) {
      S.peakCooldown = S.realm === 'thor' ? 0.42 : 0.3;
      onPeak(clamp((S.levelSmooth - 0.25) / 0.6, 0.2, 1));
    }
    // loki's mind-stone heartbeat: two thumps per cycle, faster with the voice
    if (S.realm === 'loki') { var per = 1.1 / (0.6 + S.levelSmooth * 1.4), ph = (S.t % per) / per; pulsePhase = S.speakW * (Math.exp(-ph * 14) + 0.6 * Math.exp(-((ph - 0.18) * 14))); }
    else if (S.realm === 'hela') pulsePhase = 1;
    else pulsePhase = S.levelSmooth;
  }
  function onPeak(power) {
    if (REDUCED || S.tier >= 4) return;
    if (S.realm === 'thor') strike(power);
    else if (S.realm === 'odin') ring(power);
    else if (S.realm === 'loki') { S.flash = Math.max(S.flash, 0.1 * power); S.flashCol = [120, 255, 170]; }
  }

  // ---------------------------------------------------------------------------
  // frame loop + quality governor
  // ---------------------------------------------------------------------------
  var pointer = { x: -1, y: -1, px: -1, py: -1, moved: false };
  function frame(now) {
    if (!S.running) return;
    requestAnimationFrame(frame);
    if (document.hidden) { S.last = now; return; }
    var dt = (now - S.last) / 1000; S.last = now;
    if (!(dt > 0) || dt > 0.05) dt = dt > 0.05 ? 0.05 : 1 / 60; // clamp: a negative first delta once produced NaN and killed a wake
    S.dt = dt; S.t += dt;
    // fps + governor: < 45 for 3 s drops a tier
    S.fpsAcc += dt; S.fpsN++;
    if (S.fpsAcc >= 0.5) { S.fps = S.fpsN / S.fpsAcc; S.fpsAcc = 0; S.fpsN = 0;
      if (S.fps < 45 && S.tier < 4) { if (!S.lowSince) S.lowSince = now; else if (now - S.lowSince > 3000) { setTier(S.tier + 1); S.lowSince = 0; } } else S.lowSince = 0; }
    if (REDUCED) { if (!S.frozenDrawn) { drawBack(); octx.clearRect(0, 0, S.bw, S.bh); S.frozenDrawn = true; } updateDebug(); return; }

    // smoothed state weights + timed scalars
    var k = 1 - Math.exp(-dt * 4);
    S.listenW += ((S.state === 'listening' ? 1 : 0) - S.listenW) * k;
    S.thinkW += ((S.state === 'thinking' ? 1 : 0) - S.thinkW) * k;
    S.speakW += ((S.state === 'speaking' ? 1 : 0) - S.speakW) * k * 2;
    S.charge = S.state === 'thinking' ? Math.min(1, S.charge + dt / 2.5) : Math.max(0, S.charge - dt * 2);
    S.heat += (S.heatTarget - S.heat) * (1 - Math.exp(-dt * 3));
    S.flash = Math.max(0, S.flash - dt * (S.flash > 0.5 ? 4 : 2.2));
    if (S.realm === 'odin') S.ignite = Math.min(1, S.ignite + dt / 1.2 * (S.ignite > 0 ? 1 : 0)); else S.ignite = Math.max(0, S.ignite - dt / 1.2);
    if (S.wipe > 0) { S.wipe += dt / 0.6; if (S.wipe >= 1) { S.wipe = 0; S.wipeFrom = null; } }
    if (S.drain > 0) S.drain = Math.max(0, S.drain - dt / 0.7);
    sigilShatter = Math.max(0, sigilShatter - dt / 0.8);
    updateLevel(dt, now);
    // idle sheet lightning every 6–14 s
    if (S.realm === 'thor' && S.state !== 'speaking') { sheetTimer -= dt; if (sheetTimer <= 0) { sheetTimer = rr(6, 14); S.flash = Math.max(S.flash, 0.22); S.flashCol = [200, 215, 255]; sfx.thunder(0.05); } }
    // pointer trail
    if (pointer.moved && S.tier < 4) { pointer.moved = false; trailSpawn(pointer.x, pointer.y, pointer.x - pointer.px, pointer.y - pointer.py); }
    if (S.tier < 4 || S.realm === 'hela') ambient(0);
    stepParticles(dt);
    drawBack(); drawOver();
    updateDebug();
  }
  function drawBack() {
    var c = bctx, w = S.bw, h = S.bh;
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    c.clearRect(0, 0, w, h);
    c.imageSmoothingEnabled = true;
    var live = S.tier < 4 && gl && !S.glLost && !REDUCED;
    var drawn = false;
    if (live) { try { drawn = drawShader(S.realm); } catch (e) { drawn = false; S.glLost = true; S.renderPath = 'GL-ERR/2D'; } }
    if (drawn) {
      c.drawImage(glCanvas, 0, 0, w, h);
      if (S.tier < 2) { // fake bloom: quarter-size glow, upscaled with smoothing, additive
        bloomCtx.clearRect(0, 0, bloomCanvas.width, bloomCanvas.height);
        bloomCtx.drawImage(glCanvas, 0, 0, bloomCanvas.width >> 1, bloomCanvas.height >> 1);
        c.globalCompositeOperation = 'lighter'; c.globalAlpha = 0.22 + 0.3 * S.levelSmooth + 0.4 * S.flash;
        c.drawImage(bloomCanvas, 0, 0, bloomCanvas.width >> 1, bloomCanvas.height >> 1, 0, 0, w, h);
        c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
      }
    } else if (!S.inCell) c.drawImage(staticCanvas, 0, 0, w, h);
    if (S.wipe > 0 && S.wipeFrom) { c.fillStyle = 'rgba(0,0,0,' + (1 - S.wipe) * 0.8 + ')'; c.fillRect(0, 0, w, h); } // old realm dissolving
    c.save(); c.scale(S.dpr, S.dpr);
    if (S.realm === 'odin') drawIris(c); else if (S.realm === 'loki') drawSigil(c);
    c.restore();
    drawParticles(c, 0);
  }
  function drawOver() {
    var c = octx, w = S.bw, h = S.bh;
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-over'; c.globalAlpha = 1;
    c.clearRect(0, 0, w, h);
    c.save(); c.scale(S.dpr, S.dpr);
    drawWipe(c);
    if (S.flash > 0.01) { c.fillStyle = rgba(S.flashCol, Math.min(0.85, S.flash * 0.75)); c.fillRect(0, 0, S.w, S.h); }
    if (S.heat > 0.02 && S.realm !== 'hela') { var g = c.createRadialGradient(S.w / 2, S.h / 2, Math.min(S.w, S.h) * 0.3, S.w / 2, S.h / 2, Math.max(S.w, S.h) * 0.75); g.addColorStop(0, 'rgba(255,40,30,0)'); g.addColorStop(1, 'rgba(255,40,30,' + 0.35 * S.heat * (0.7 + 0.3 * Math.sin(S.t * 3)) + ')'); c.fillStyle = g; c.fillRect(0, 0, S.w, S.h); }
    c.lineCap = 'round'; c.lineJoin = 'round';
    if (S.realm === 'thor') { drawBolts(c); drawStaticCharge(c); }
    else if (S.realm === 'odin') drawRings(c);
    else if (S.realm === 'loki') { drawTimeSlips(c); drawShards(c); }
    drawDrain(c);
    c.restore();
    drawParticles(c, 1);
  }
  function setTier(t) {
    t = clamp(t | 0, 0, 4); var was = S.tier; S.tier = t; store.set('tier', t);
    if ((was < 3) !== (t < 3)) resize(); else prerenderStatic();
  }
  function updateDebug() {
    if (!debugEl) return;
    debugEl.textContent = 'ASGARD FX  ' + S.fps.toFixed(0) + ' FPS\nTIER ' + S.tier + ' ' + TIER_NAMES[S.tier] + '\nRENDER PATH ' + S.renderPath + (S.inCell ? ' (in cell)' : '') + '\nREALM ' + S.realm + '  STATE ' + S.state + '\nLEVEL ' + S.levelSmooth.toFixed(2) + (S.levelExternal ? ' (hall)' : ' (synth)') + '  P ' + P.count + '\nSOUND ' + (S.muted ? 'MUTED' : 'ON') + '  DPR ' + S.dpr + (REDUCED ? '\nREDUCED MOTION' : '');
  }

  // ---------------------------------------------------------------------------
  // kinetic transcript — words reveal as the voice moves. The hall's DOM is
  // watched, never rebuilt: only the newest reply's text node is wrapped.
  // ---------------------------------------------------------------------------
  var lastReceiveAt = 0, kineticStyle = false, kineticRaf = 0;
  function watchTranscript() {
    var log = document.getElementById('chatLog'); if (!log || !window.MutationObserver) return;
    new MutationObserver(function (muts) {
      if (performance.now() - lastReceiveAt > 4000 || REDUCED) return;
      var el = null;
      for (var i = 0; i < muts.length; i++) for (var j = 0; j < muts[i].addedNodes.length; j++) { var n = muts[i].addedNodes[j]; if (n.nodeType === 1 && n.classList && n.classList.contains('assistant') && (n.textContent || '').trim() !== '...') el = n; }
      if (el) { lastReplyEl = el; kinetic(el); }
    }).observe(log, { childList: true });
  }
  function kinetic(el) {
    try {
      if (!kineticStyle) { kineticStyle = true; var st = document.createElement('style'); st.textContent = '.fx-w{opacity:0;transition:opacity .14s ease-out}.fx-w.on{opacity:1}'; document.head.appendChild(st); }
      var tn = null; for (var i = el.childNodes.length - 1; i >= 0; i--) if (el.childNodes[i].nodeType === 3) { tn = el.childNodes[i]; break; }
      if (!tn) return;
      var words = tn.nodeValue.split(/(\s+)/), frag = document.createDocumentFragment(), spans = [];
      for (var w = 0; w < words.length; w++) { if (!words[w]) continue; if (/^\s+$/.test(words[w])) { frag.appendChild(document.createTextNode(words[w])); continue; } var sp = document.createElement('span'); sp.className = 'fx-w'; sp.textContent = words[w]; frag.appendChild(sp); spans.push(sp); }
      el.replaceChild(frag, tn);
      var glow = PALETTE[S.realm].glow, idx = 0, acc = 0, t0 = performance.now(), last = t0, backstop = Math.max(4000, spans.length * 300), started = false;
      cancelAnimationFrame(kineticRaf);
      (function tick(now) {
        var dt = Math.min(0.05, Math.max(0, (now - last) / 1000)); last = now;
        if (S.state === 'speaking') started = true;
        var rate = S.state === 'speaking' ? 2 + S.levelSmooth * 14 : (started ? 30 : 3);
        acc += dt * rate;
        var done = now - t0 > backstop;
        while (idx < spans.length && (acc >= 1 || done)) { acc -= 1; spans[idx].classList.add('on'); spans[idx].style.textShadow = '0 0 9px ' + glow + '0.9)'; spans[idx].style.color = 'rgb(' + PALETTE[S.realm].hot.join(',') + ')'; var s = spans[idx]; setTimeout(function () { s.style.textShadow = ''; s.style.color = ''; }, 700); idx++; }
        if (idx < spans.length) kineticRaf = requestAnimationFrame(tick);
      })(t0);
    } catch (e) { /* never let a visual break the transcript */ }
  }

  // ---------------------------------------------------------------------------
  // the vault — her cell is opaque and above everything, so while she holds
  // the room both layers move INSIDE it, above her canvas and beneath her
  // furniture. Nothing of hers is read, written or restyled.
  // ---------------------------------------------------------------------------
  var cellPoll = 0, homeBackNext = null;
  function enterCell() {
    var tries = 0; clearInterval(cellPoll);
    cellPoll = setInterval(function () {
      var cell = document.getElementById('h9Cell'), cv = document.getElementById('h9Canvas');
      if (cell && cv) {
        clearInterval(cellPoll);
        [back, over].forEach(function (c) { c.style.position = 'absolute'; c.style.zIndex = 'auto'; c.style.width = '100%'; c.style.height = '100%'; cell.insertBefore(c, cv.nextSibling); });
        cell.insertBefore(back, over);
        S.inCell = true;
      } else if (++tries > 60) clearInterval(cellPoll);
    }, 50);
  }
  function leaveCell() {
    clearInterval(cellPoll);
    if (!S.inCell) return;
    S.inCell = false;
    [back, over].forEach(function (c) { c.style.position = 'fixed'; c.style.width = '100vw'; c.style.height = '100vh'; });
    back.style.zIndex = '0'; over.style.zIndex = '26';
    var bd = document.getElementById('backdrop');
    if (bd && bd.parentNode) bd.parentNode.insertBefore(back, bd.nextSibling); else document.body.insertBefore(back, document.body.firstChild);
    document.body.appendChild(over);
  }

  // ---------------------------------------------------------------------------
  // public API
  // ---------------------------------------------------------------------------
  var inited = false, personaBeforeVault = 'thor';
  function realmFor(id) { return REALM_OF[String(id || '').toLowerCase()] || 'thor'; }
  function applyRealm(realm, silent) {
    if (realm === S.realm) return;
    S.prevRealm = S.realm; S.realm = realm;
    killAll(); prerenderStatic(); S.frozenDrawn = false; S.charge = 0; S.ignite = realm === 'odin' && !silent ? 0.001 : 0;
    if (!silent && !REDUCED) { S.wipe = 0.001; S.wipeFrom = S.prevRealm; sfx.swtch(); }
    for (var i = 0; i < 30; i++) ambient(1);
    sfx.hum(true, realm);
  }
  var API = {
    init: function (opts) {
      if (inited) { if (opts && opts.persona) API.setPersona(opts.persona); return API; }
      inited = true;
      if (DISABLED) return API;
      try {
        mountLayers(); initGL();
        var storedTier = parseInt(store.get('tier'), 10); if (storedTier >= 0 && storedTier <= 4) S.tier = storedTier;
        S.muted = store.get('mute') === '1';
        var pid = (opts && opts.persona) || document.documentElement.getAttribute('data-persona') || 'rayven';
        S.realm = realmFor(pid); personaBeforeVault = S.realm;
        resize();
        window.addEventListener('resize', onResize);
        var onMove = function (e) { var p = e.touches ? e.touches[0] : e; if (!p) return; pointer.px = pointer.x < 0 ? p.clientX : pointer.x; pointer.py = pointer.y < 0 ? p.clientY : pointer.y; pointer.x = p.clientX; pointer.y = p.clientY; pointer.moved = true; };
        window.addEventListener('pointermove', onMove, { passive: true });
        window.addEventListener('touchmove', onMove, { passive: true });
        var unlock = function () { sfx.unlock(); sfx.hum(true, S.realm); };
        window.addEventListener('pointerdown', unlock, { passive: true });
        window.addEventListener('keydown', unlock, { passive: true });
        hookReactor(); var hk = setInterval(function () { hookReactor(); if (reactorHooked || ++hookTries > 60) clearInterval(hk); }, 500);
        watchTranscript();
        S.running = true; S.last = performance.now();
        requestAnimationFrame(frame);
      } catch (e) { S.running = false; if (DEBUG) console.warn('[AsgardFX] init failed', e); }
      return API;
    },
    setPersona: function (id) { if (!S.running) return; if (S.vaultOpen) { personaBeforeVault = realmFor(id); return; } applyRealm(realmFor(id), false); },
    setState: function (state, level) {
      if (!S.running) return;
      state = String(state || 'idle').toLowerCase(); if (state === 'talking') state = 'speaking';
      if (state !== 'idle' && state !== 'listening' && state !== 'thinking' && state !== 'speaking') state = 'idle';
      if (state === 'speaking' && S.state !== 'speaking') { S.speakStart = S.t; S.levelExternal = false; }
      if (state !== 'thinking' && S.state === 'thinking' && S.realm === 'thor' && S.charge > 0.5 && !REDUCED) strike(0.55); // the bolt that was building
      S.state = state;
      if (typeof level === 'number') feedLevel(level);
    },
    wake: function (id) {
      if (!S.running || REDUCED) return;
      if (id) { var r = realmFor(id); if (r !== S.realm && !S.vaultOpen) applyRealm(r, true); }
      S.ignite = 1; S.flash = Math.max(S.flash, 0.6); S.flashCol = PALETTE[S.realm].hot;
      if (S.realm === 'thor') { strike(1); strike(0.7); }
      else if (S.realm === 'loki') { sigilShatter = 1; for (var i = 0; i < 40; i++) { var a = rnd() * 6.283, sp = rr(60, 240); spawn(1, S.w / 2, S.h / 2, Math.cos(a) * sp, Math.sin(a) * sp, rr(1.2, 2.5), rr(6, 14), rnd()); } }
      else if (S.realm === 'odin') { ring(1); for (var j = 0; j < 60; j++) spawn(2, rr(0, 1) * S.w, S.h + rr(0, 40), rr(-10, 10), rr(-80, -30), rr(3, 6), rr(1, 2.5), rnd()); }
      sfx.wake(S.realm);
    },
    pulse: function (kind) {
      if (!S.running) return;
      kind = String(kind || '').toLowerCase();
      var Pl = PALETTE[S.realm];
      if (kind === 'send') { S.flash = Math.max(S.flash, 0.08); S.flashCol = Pl.main; sfx.send(); }
      else if (kind === 'receive') { lastReceiveAt = performance.now(); S.flash = Math.max(S.flash, 0.14); S.flashCol = Pl.main; if (S.realm === 'odin') ring(0.5); sfx.receive(); }
      else if (kind === 'error') { S.flash = Math.max(S.flash, 0.3); S.flashCol = [255, 60, 40]; sfx.error(); }
      else if (kind === 'switch') { S.flash = Math.max(S.flash, 0.2); S.flashCol = Pl.hot; }
      else if (kind === 'vault-open') { if (!S.vaultOpen) { S.vaultOpen = true; personaBeforeVault = S.realm; applyRealm('hela', true); S.state = 'idle'; enterCell(); sfx.vault(true); } }
      else if (kind === 'vault-close') { if (S.vaultOpen) { S.vaultOpen = false; S.heatTarget = 0; leaveCell(); S.drain = 1; applyRealm(personaBeforeVault, true); sfx.vault(false); } }
      else if (kind === 'lock-in') { S.heatTarget = 1; S.flash = Math.max(S.flash, 0.25); S.flashCol = [255, 50, 40]; }
      else if (kind === 'stand-down') { S.heatTarget = 0; }
    },
    mute: function (m) { S.muted = !!m; store.set('mute', S.muted ? '1' : '0'); sfx.setMuted(S.muted); return S.muted; },
    setTier: function (t) { if (S.running) setTier(t); },
    state: function () { return { realm: S.realm, state: S.state, tier: S.tier, fps: S.fps, renderPath: S.renderPath, particles: P.count, muted: S.muted, inCell: S.inCell }; }
  };
  window.AsgardFX = API;
})();
