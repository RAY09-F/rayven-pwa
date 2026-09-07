/* ASGARD FX — THE COUNCIL. Strike Three, Phase 2.
   Five advisor gems on their own small plinths in a ring around a god's arc
   core, a thin light tether from each gem to the core, up to four tool
   markers per gem, and the names as HTML on the plinths. The signature
   interaction: selecting an advisor lights only its tether and its markers
   and settles everything else. Gem click, the HTML list and keyboard focus
   are equivalent ways in; focus lives on the HTML list and the gem mirrors it.
   Real state only: a gem ignites when /council/status reports a run that was
   not there at the previous poll — never on its own. Odin's five carry
   PAPER / SIM on every number, from /paper-trading/status.
   Loaded BY asgard-fx.js; renders inside the engine's scene. */
(function () {
  'use strict';
  const FX = window.AsgardFX;
  if (!FX || !FX.registerCouncil) return;

  const TAU = Math.PI * 2;
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const ease = (v, t, dt, tau) => v + (t - v) * (dt <= 0 ? 0 : Math.min(1, dt / tau));

  // Identity: ids, names and roles as src/lib/council.js; colours from the design
  // skill (Odin's five from public/team.html, the source of truth). Tool groups
  // are the councillor's real tool list folded into four labels; `more` is how
  // many real tools sit behind the four.
  const COUNCILS = {
    thor: [
      { id: 'jane_foster', name: 'JANE FOSTER', role: 'the Seer', color: 0xD9455F, tools: ['WEB SEARCH', 'DEEP RESEARCH', 'NEWS', 'LOOK-UP'], more: 4 },
      { id: 'darcy', name: 'DARCY', role: 'the Keeper', color: 0x9B6BE0, tools: ['MEMORY', 'TO-DOS', 'CALENDAR', 'TIMERS'], more: 8 },
      { id: 'valkyrie', name: 'VALKYRIE', role: 'the Road', color: 0xBCE0F5, tools: ['MAPS', 'WEATHER', 'SPOTIFY', 'YOUTUBE'], more: 11 },
      { id: 'korg', name: 'KORG', role: 'the Herald', color: 0xE8DCC8, tools: ['TEXTS', 'CALLS', 'JARVIS & KEVOS', 'TRANSLATE'], more: 2 },
      { id: 'hulk', name: 'HULK', role: 'the Hands', color: 0x4FBF8A, tools: ['NAVIGATE', 'READ PAGE', 'CLICK & TYPE', 'SCREENSHOT'], more: 5 }
    ],
    loki: [
      { id: 'miss_minutes', name: 'MISS MINUTES', role: 'the Clock', color: 0xE08A3C, tools: ['CALENDAR', 'TIMERS', 'DAYS UNTIL', 'WORLD TIME'], more: 4 },
      { id: 'kang', name: 'KANG', role: 'the Watch', color: 0x8B6BD9, tools: ['WATCH ADD', 'WATCH LIST', 'PAUSE / RESUME', 'PAGE HISTORY'], more: 2 },
      { id: 'hunter_b15', name: 'HUNTER B-15', role: 'the Runner', color: 0xBCD8F5, tools: ['WEB SEARCH', 'RESEARCH', 'NEWS', 'LOOK-UP'], more: 1 },
      { id: 'sylvie', name: 'SYLVIE', role: 'the Apocalypses', color: 0x3E9C8F, tools: ['WEATHER', 'AIR & QUAKES', 'CURRENCY', 'CALCULATE'], more: 5 },
      { id: 'mobius', name: 'MOBIUS', role: 'the Ledger', color: 0xE4CBA8, tools: ['TO-DOS', 'IDEAS', 'MEMORY', 'SEARCH MEMORY'], more: 3 }
    ],
    odin: [   // paper-trading agents: markers are instrument, open position, P&L, last trade — every number PAPER / SIM
      { id: 'volstagg', name: 'VOLSTAGG', role: 'S&P 500 (SPY) trend', color: 0xB5713A, paper: 'baldr' },
      { id: 'frigga', name: 'FRIGGA', role: 'Ethereum momentum', color: 0xFF7A1A, paper: 'freya' },
      { id: 'heimdall', name: 'HEIMDALL', role: 'Gold (GLD) momentum', color: 0xF2C14E, paper: 'vidar' },
      { id: 'hogun', name: 'HOGUN', role: 'Nasdaq (QQQ) trend', color: 0xB3121B, paper: 'heimdall' },
      { id: 'fandral', name: 'FANDRAL', role: 'Bitcoin mean-reversion', color: 0x8B5CF6, paper: 'tyr' }
    ]
  };
  const ANGLES = [-36, 36, -108, 108, 180].map(d => d * Math.PI / 180);   // around the front; the front centre stays open for the core
  const RING_R = 2.5, FLOOR_Y = -0.95, GEM_Y = -0.52;
  const PAPER = 'PAPER / SIM';
  const POLL_MS = 30000, PAPER_MS = 60000;

  const CSS = [
    '#asgardFxCouncil{position:fixed;inset:0;z-index:4;pointer-events:none;font-family:"Cinzel",Georgia,serif}',
    '#asgardFxCouncil .afx-adv{position:absolute;left:0;top:0;transform:translate3d(-9999px,-9999px,0);will-change:transform;pointer-events:auto;cursor:pointer;',
    '  display:flex;flex-direction:column;align-items:center;justify-content:center;min-width:44px;min-height:44px;padding:6px 12px;border-radius:9px;',
    '  background:rgba(11,10,18,.74);border:1px solid rgba(200,209,220,.22);color:#ECEAF2;text-align:center;line-height:1.15;transition:border-color .25s,box-shadow .25s,opacity .3s}',
    '#asgardFxCouncil .afx-adv b{font-weight:600;font-size:11px;letter-spacing:.16em;white-space:nowrap}',
    '#asgardFxCouncil .afx-adv span{font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:10px;letter-spacing:.06em;color:rgba(200,209,220,.7);margin-top:2px;white-space:nowrap}',
    '#asgardFxCouncil .afx-adv.dim{opacity:.55}',
    '#asgardFxCouncil .afx-adv.on{box-shadow:0 0 14px var(--afx-c,#ECEAF2);border-color:var(--afx-c,#ECEAF2)}',
    '#asgardFxCouncil .afx-adv:focus-visible{outline:2px solid #E7C24A;outline-offset:2px}',
    '#asgardFxCouncil .afx-sheet{position:absolute;left:0;top:0;transform:translate3d(-9999px,-9999px,0);will-change:transform;pointer-events:auto;width:236px;padding:10px 12px 11px;border-radius:10px;',
    '  background:rgba(11,10,18,.88);border:1px solid rgba(200,209,220,.25);color:#ECEAF2;font-family:system-ui,-apple-system,"Segoe UI",sans-serif;font-size:13px;line-height:1.4}',
    '#asgardFxCouncil .afx-sheet[hidden]{display:none}',
    '#asgardFxCouncil .afx-sheet h4{margin:0 0 2px;font:600 12px/1.2 "Cinzel",Georgia,serif;letter-spacing:.18em}',
    '#asgardFxCouncil .afx-sheet .r{color:rgba(200,209,220,.75);font-size:12px;margin-bottom:7px}',
    '#asgardFxCouncil .afx-sheet ul{list-style:none;margin:0;padding:0}',
    '#asgardFxCouncil .afx-sheet li{display:flex;justify-content:space-between;gap:10px;padding:3px 0;border-top:1px solid rgba(200,209,220,.1)}',
    '#asgardFxCouncil .afx-sheet li i{font-style:normal;color:#E7C24A;font-size:10px;letter-spacing:.12em;white-space:nowrap}',
    '#asgardFxCouncil .afx-sheet .more{color:rgba(200,209,220,.65);font-size:12px;margin-top:6px}',
    '#asgardFxCouncil .afx-sheet .st{color:rgba(200,209,220,.65);font-size:11px;margin-top:6px}',
    '@media (max-width:560px){#asgardFxCouncil .afx-adv span{display:none}#asgardFxCouncil .afx-sheet{width:200px}}'
  ].join('\n');

  const O = {};              // scene objects and DOM, per mount
  const M = { sel: null, hover: null, t: 0, streams: {}, seen: {}, primed: false, nextPoll: 0, nextPaper: 0, paper: null, polling: false, visible: true, q: 0 };
  let C = null, built = false, T = null, LIST = null, PERSONA = null;

  function fmtMoney(v) { if (typeof v !== 'number' || !isFinite(v)) return '—'; return (v < 0 ? '−' : v > 0 ? '+' : '') + '$' + Math.abs(v).toFixed(2); }
  function fmtPct(v) { if (typeof v !== 'number' || !isFinite(v)) return ''; return ' (' + (v >= 0 ? '+' : '−') + Math.abs(v * 100).toFixed(1) + '%)'; }
  function timeAgo(iso) { if (!iso) return 'never'; const s = (Date.now() - Date.parse(iso)) / 1000; if (!(s >= 0)) return '—'; if (s < 90) return 'just now'; if (s < 3600) return Math.round(s / 60) + ' min ago'; if (s < 86400) return Math.round(s / 3600) + ' h ago'; return Math.round(s / 86400) + ' d ago'; }

  // ------------------------------------------------------------ DOM
  function buildDom() {
    if (!document.getElementById('asgardFxCouncilStyle')) { const st = document.createElement('style'); st.id = 'asgardFxCouncilStyle'; st.textContent = CSS; document.head.appendChild(st); }
    const layer = document.createElement('div'); layer.id = 'asgardFxCouncil'; layer.setAttribute('role', 'group'); layer.setAttribute('aria-label', 'Council of ' + PERSONA.toUpperCase());
    O.labels = [];
    LIST.forEach((a, i) => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'afx-adv'; b.dataset.id = a.id; b.setAttribute('aria-pressed', 'false');
      b.style.setProperty('--afx-c', '#' + a.color.toString(16).padStart(6, '0'));
      const n = document.createElement('b'); n.textContent = a.name; const r = document.createElement('span'); r.textContent = a.role; b.appendChild(n); b.appendChild(r);
      b.addEventListener('click', onLabelClick); b.addEventListener('focus', onLabelFocus);
      layer.appendChild(b); O.labels.push(b);
    });
    const sh = document.createElement('div'); sh.className = 'afx-sheet'; sh.hidden = true; sh.setAttribute('role', 'status'); layer.appendChild(sh); O.sheet = sh;
    document.body.appendChild(layer); O.layer = layer;
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('keydown', onKey);
    document.addEventListener('visibilitychange', onVis);
  }
  function onLabelClick(e) { const id = e.currentTarget.dataset.id; select(M.sel === id ? null : id); }
  function onLabelFocus(e) { const id = e.currentTarget.dataset.id; if (M.sel !== id) select(id); }
  function onKey(e) { if (e.key === 'Escape' && M.sel) select(null); }
  function onVis() { M.visible = !document.hidden; }
  function onPointerDown(e) {
    if (!built || !C || !C.camera) return;
    const t = e.target; if (!(t === document.body || t === document.documentElement || (t && t.tagName === 'CANVAS'))) return;
    if (typeof e.button === 'number' && e.button !== 0) return;
    O.ndc.set((e.clientX / C.w) * 2 - 1, -(e.clientY / C.h) * 2 + 1);
    O.ray.setFromCamera(O.ndc, C.camera);
    const hits = O.ray.intersectObjects(O.gems, false);
    if (hits.length) { const id = hits[0].object.userData.id; select(M.sel === id ? null : id); }
    else if (M.sel) select(null);
  }
  function select(id) {
    M.sel = id || null;
    for (const b of O.labels) { const on = b.dataset.id === M.sel; b.classList.toggle('on', on); b.classList.toggle('dim', !!M.sel && !on); b.setAttribute('aria-pressed', on ? 'true' : 'false'); }
    if (M.sel) { fillSheet(); O.sheet.hidden = false; } else O.sheet.hidden = true;
    if (C && C.onSelect) { try { C.onSelect(M.sel); } catch (e) {} }
    M.markDirty = true;
  }
  function fillSheet() {
    const a = LIST.find(x => x.id === M.sel); if (!a) return;
    const sh = O.sheet; while (sh.firstChild) sh.removeChild(sh.firstChild);
    const h = document.createElement('h4'); h.textContent = a.name; sh.appendChild(h);
    const r = document.createElement('div'); r.className = 'r'; r.textContent = a.role; sh.appendChild(r);
    const ul = document.createElement('ul');
    if (a.paper) {
      const p = M.paper, agent = p && p.agents && p.agents[a.paper], pos = p && p.openPositions && p.openPositions[a.paper];
      const trades = (p && p.recentTrades || []).filter(t => t.agent === a.paper);
      const last = trades[0]; let pnl = 0; for (const t of trades) if (typeof t.pnl === 'number') pnl += t.pnl;
      const rows = [
        ['INSTRUMENT', agent ? String(agent.label || '').split(' — ')[0] : (p ? '—' : 'Unavailable')],
        ['POSITION', p ? (pos ? ('long ' + (typeof pos.qty === 'number' ? pos.qty.toFixed(3) : '') + ' @ ' + (typeof pos.entryPrice === 'number' ? pos.entryPrice : '—')) : 'flat') : 'Unavailable'],
        ['P&L, RECENT', p ? (trades.length ? fmtMoney(pnl) : 'no closed trades') : 'Unavailable'],
        ['LAST TRADE', p ? (last ? (last.side + ' ' + fmtMoney(last.pnl) + fmtPct(last.pnlPct)) : 'none yet') : 'Unavailable']
      ];
      for (const [k, v] of rows) { const li = document.createElement('li'); li.appendChild(document.createTextNode(k + ' · ' + v + ' ')); const i = document.createElement('i'); i.textContent = PAPER; li.appendChild(i); ul.appendChild(li); }
    } else {
      for (const t of a.tools) { const li = document.createElement('li'); li.textContent = t; ul.appendChild(li); }
    }
    sh.appendChild(ul);
    if (!a.paper && a.more > 0) { const m = document.createElement('div'); m.className = 'more'; m.textContent = '+' + a.more + ' more tools'; sh.appendChild(m); }
    const st = document.createElement('div'); st.className = 'st';
    const seen = M.seen[a.id]; st.textContent = M.primed ? ('last run ' + timeAgo(seen && seen.lastRun) + (seen && seen.runs ? ' · ' + seen.runs + ' run' + (seen.runs === 1 ? '' : 's') : '')) : 'council status: not yet read';
    sh.appendChild(st);
  }

  // ---------------------------------------------------------- scene
  function build(ctx) {
    const THREE = T;
    const root = O.root = new THREE.Group();
    O.geos = [
      O.gemGeo = new THREE.OctahedronGeometry(0.17, 0),
      O.plinthGeo = new THREE.CylinderGeometry(0.24, 0.28, 0.12, 24),
      O.markGeo = new THREE.OctahedronGeometry(0.045, 0),
      O.pulseGeo = new THREE.SphereGeometry(0.04, 8, 6)
    ];
    O.gemGeo.scale(1, 1.55, 1);
    O.mats = { plum: new THREE.MeshStandardMaterial({ color: 0x292337, roughness: 0.45, metalness: 0.25 }), mark: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.15, roughness: 0.3, metalness: 0.2, flatShading: true }) };
    O.gems = []; O.gemMats = []; O.tethers = []; O.tetherMats = []; O.pulses = []; O.pos = []; O.top = [];
    O.markers = new THREE.InstancedMesh(O.markGeo, O.mats.mark, LIST.length * 4); O.markers.frustumCulled = false; root.add(O.markers);
    O.markColors = []; O.markBase = [];
    const m4 = new THREE.Matrix4(), col = new THREE.Color();
    LIST.forEach((a, i) => {
      const ang = ANGLES[i], x = RING_R * Math.sin(ang), z = RING_R * Math.cos(ang);
      const plinth = new THREE.Mesh(O.plinthGeo, O.mats.plum); plinth.position.set(x, FLOOR_Y + 0.06, z); root.add(plinth);
      const gm = new THREE.MeshStandardMaterial({ color: a.color, emissive: a.color, emissiveIntensity: 0.3, roughness: 0.22, metalness: 0.1, flatShading: true }); O.gemMats.push(gm);
      const gem = new THREE.Mesh(O.gemGeo, gm); gem.position.set(x, GEM_Y, z); gem.userData.id = a.id; gem.userData.i = i; root.add(gem); O.gems.push(gem);
      O.pos.push(new THREE.Vector3(x, GEM_Y, z)); O.top.push(new THREE.Vector3(x, FLOOR_Y + 0.12, z));
      // tether: gem → the core's anchor, vertex colours fading toward the core
      const tg = new THREE.BufferGeometry();
      const pts = new Float32Array([x, GEM_Y, z, ctx.anchor.x, ctx.anchor.y - 0.35, ctx.anchor.z]);
      col.set(a.color); const cs = new Float32Array([col.r, col.g, col.b, col.r * 0.35, col.g * 0.35, col.b * 0.35]);
      tg.setAttribute('position', new THREE.BufferAttribute(pts, 3)); tg.setAttribute('color', new THREE.BufferAttribute(cs, 3)); O.geos.push(tg);
      const tm = new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.45 }); O.tetherMats.push(tm);
      const line = new THREE.Line(tg, tm); root.add(line); O.tethers.push(line);
      // pulse that streams down the tether when the backend confirms a run
      const pm = new THREE.MeshBasicMaterial({ color: a.color, transparent: true, opacity: 0.95 }); O.gemMats.push(pm);
      const pulse = new THREE.Mesh(O.pulseGeo, pm); pulse.visible = false; root.add(pulse); O.pulses.push(pulse);
      // four markers in a small arc outside the gem
      for (let k = 0; k < 4; k++) {
        const aa = ang + (k - 1.5) * 0.34, r = 0.44;
        m4.makeTranslation(x + Math.sin(aa) * r, GEM_Y - 0.06 + (k % 2) * 0.05, z + Math.cos(aa) * r);
        O.markers.setMatrixAt(i * 4 + k, m4);
        col.set(a.color); O.markBase.push(col.clone()); O.markers.setColorAt(i * 4 + k, col.multiplyScalar(0.45));
      }
    });
    O.markers.instanceMatrix.needsUpdate = true; if (O.markers.instanceColor) O.markers.instanceColor.needsUpdate = true;
    O.ray = new THREE.Raycaster(); O.ndc = new THREE.Vector2(); O.tmp = new THREE.Vector3(); O.tmpC = new THREE.Color(); O.out = { x: 0, y: 0 };
    O.lit = new Float32Array(LIST.length); O.ign = new Float32Array(LIST.length);
    for (let i = 0; i < LIST.length; i++) O.lit[i] = 0.5;
    ctx.scene.add(root);
  }

  // ------------------------------------------------------- live state
  function poll() {
    if (M.polling || !M.visible) return;
    M.polling = true;
    const c = new AbortController(); const to = setTimeout(() => c.abort(), 20000);
    fetch('/council/status', { signal: c.signal }).then(r => (r.ok ? r.json() : null)).then(j => {
      if (!j || !j.councils || !j.councils[PERSONA]) return;      // a missing route hides its own segment: nothing ignites, nothing errors
      for (const row of j.councils[PERSONA]) {
        const prev = M.seen[row.id];
        if (M.primed && prev && row.lastRun && row.lastRun !== prev.lastRun) ignite(row.id);
        M.seen[row.id] = { lastRun: row.lastRun || null, runs: row.runs || 0 };
      }
      M.primed = true;
      if (M.sel && !O.sheet.hidden) fillSheet();
    }).catch(() => {}).finally(() => { clearTimeout(to); M.polling = false; });
  }
  function pollPaper() {
    if (PERSONA !== 'odin' || M.paperBusy || !M.visible) return;
    M.paperBusy = true;
    const c = new AbortController(); const to = setTimeout(() => c.abort(), 20000);
    fetch('/paper-trading/status', { signal: c.signal }).then(r => (r.ok ? r.json() : null)).then(j => {
      if (!j) return; M.paper = j; M.markDirty = true;
      if (M.sel && !O.sheet.hidden) fillSheet();
    }).catch(() => {}).finally(() => { clearTimeout(to); M.paperBusy = false; });
  }
  function ignite(id) {
    const i = LIST.findIndex(a => a.id === id); if (i < 0) return;
    M.streams[id] = { i, t: 0, d: 1.6 };
    O.ign[i] = 1;
  }

  // ------------------------------------------------------------- API
  const COUNCIL = {
    mount(ctx, personaId) {
      C = ctx; T = ctx.THREE; PERSONA = personaId; LIST = COUNCILS[personaId];
      if (!LIST) return;                                            // no council for anything else; nothing is built or named
      M.sel = null; M.streams = {}; M.seen = {}; M.primed = false; M.paper = null; M.t = 0;
      M.nextPoll = performance.now() + 2500; M.nextPaper = performance.now() + 4000;
      build(ctx); buildDom(); built = true;
      this.setQuality(ctx.quality);
    },
    selected() { return M.sel; },
    select(id) { if (built) select(id); },
    setQuality(q) { M.q = q; if (!built) return; O.markers.visible = q < 3; },
    update(dt) {
      if (!built) return;
      dt = dt > 0 ? Math.min(dt, 0.1) : 0; M.t += dt;
      const now = performance.now();
      if (now >= M.nextPoll) { M.nextPoll = now + POLL_MS; poll(); }
      if (PERSONA === 'odin' && now >= M.nextPaper) { M.nextPaper = now + PAPER_MS; pollPaper(); }
      const n = LIST.length, anchor = C.anchor;
      for (let i = 0; i < n; i++) {
        const a = LIST[i], isSel = M.sel === a.id;
        const target = isSel ? 1 : (M.sel ? 0.12 : 0.5);
        O.lit[i] = ease(O.lit[i], target, dt, 0.3);
        if (O.ign[i] > 0) O.ign[i] = Math.max(0, O.ign[i] - dt / 2.2);
        const lit = O.lit[i], glow = clamp(lit + O.ign[i], 0, 1.3);
        const gem = O.gems[i];
        gem.position.y = GEM_Y + 0.02 * Math.sin(M.t * 0.8 + i * 1.3);
        gem.rotation.y += dt * (0.25 + O.ign[i] * 2);
        O.gemMats[i * 2].emissiveIntensity = 0.2 + 0.8 * glow;
        O.tetherMats[i].opacity = 0.12 + 0.83 * glow;
        // streaming pulse from gem to core; one ring when it arrives
        const st = M.streams[a.id];
        if (st) {
          st.t += dt; const k = clamp(st.t / st.d, 0, 1), kk = k * k * (3 - 2 * k);
          const p = O.pulses[i]; p.visible = true;
          p.position.set(O.pos[i].x + (anchor.x - O.pos[i].x) * kk, O.pos[i].y + (anchor.y - 0.35 - O.pos[i].y) * kk, O.pos[i].z + (anchor.z - O.pos[i].z) * kk);
          if (k >= 1 || st.t > 3) {
            p.visible = false; delete M.streams[a.id];
            const s = C.project(anchor, O.out); C.ring(s.x, s.y, [(a.color >> 16) & 255, (a.color >> 8) & 255, a.color & 255], 620, 2, 240);
          }
        }
      }
      if (M.markDirty || M.sel !== M.markSel) {
        M.markDirty = false; M.markSel = M.sel;
        for (let i = 0; i < n; i++) {
          const a = LIST[i], isSel = M.sel === a.id, k = isSel ? 1 : (M.sel ? 0.25 : 0.45);
          const open = a.paper && M.paper && M.paper.openPositions && M.paper.openPositions[a.paper];
          for (let m = 0; m < 4; m++) { O.tmpC.copy(O.markBase[i * 4 + m]).multiplyScalar(k * (open && m === 1 ? 1.6 : 1)); O.markers.setColorAt(i * 4 + m, O.tmpC); }
        }
        if (O.markers.instanceColor) O.markers.instanceColor.needsUpdate = true;
      }
    },
    // 15 Hz: HTML names ride their plinths. Transform only, no layout reads, no allocation.
    layout(ctx) {
      if (!built) return;
      const w = ctx.w, h = ctx.h;
      for (let i = 0; i < LIST.length; i++) {
        const s = ctx.project(O.top[i], O.out);
        const x = Math.round(s.x), y = Math.round(s.y + 8);
        O.labels[i].style.transform = 'translate3d(' + (x - 60) + 'px,' + y + 'px,0)';
        if (M.sel === LIST[i].id && !O.sheet.hidden) {
          const sx = clamp(x - 118, 8, w - 244), sy = y + 58;
          O.sheet.style.transform = 'translate3d(' + sx + 'px,' + Math.min(sy, h - 150) + 'px,0)';
        }
      }
    },
    resize() { /* labels follow on the next layout tick */ },
    lost() { built = false; O.root = null; O.gems = []; },       // the GL context is gone: forget the scene objects, keep nothing that would call GL
    dispose() {
      built = false;
      try { window.removeEventListener('pointerdown', onPointerDown); window.removeEventListener('keydown', onKey); document.removeEventListener('visibilitychange', onVis); } catch (e) {}
      try { if (O.layer && O.layer.parentNode) O.layer.parentNode.removeChild(O.layer); } catch (e) {}
      try { if (C && C.scene && O.root) C.scene.remove(O.root); } catch (e) {}
      for (const g of (O.geos || [])) { try { g.dispose(); } catch (e) {} }
      for (const m of (O.gemMats || [])) { try { m.dispose(); } catch (e) {} }
      for (const m of (O.tetherMats || [])) { try { m.dispose(); } catch (e) {} }
      if (O.mats) for (const k in O.mats) { try { O.mats[k].dispose(); } catch (e) {} }
      if (O.markers) { try { O.markers.dispose(); } catch (e) {} }
      for (const k in O) delete O[k];
      M.sel = null; M.streams = {}; C = null; LIST = null; PERSONA = null;
    }
  };
  FX.registerCouncil(COUNCIL);
})();
