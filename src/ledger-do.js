import {executionState} from './lib/bridge-runs.js';
import { mirrorConversation } from './lib/conversation-mirror.js';
import { approvalClaim } from './lib/approval-claims.js';
// THE LEDGER (asgard-upgrade Phase 9). One Durable Object class, SQLite-backed,
// holding the state this upgrade introduced: ticks, audit lines, events, routine
// runs, council state, cost counters, routines. COPY-FORWARD only: nothing in KV
// is deleted or read-migrated; memory, history, the paper book, capabilities and
// config never move. Extends DurableObject from "cloudflare:workers" -- a runtime
// module, not an npm package (Rule 3). Selected by the wrangler var
// LEDGER_BACKEND = 'kv' | 'do' through src/lib/ledger.js; every method here is
// plain request/response so the accessor can call it over the stub.
import { DurableObject } from 'cloudflare:workers';

const SCHEMA = [
  `CREATE TABLE IF NOT EXISTS tick (key TEXT PRIMARY KEY, at TEXT NOT NULL, body TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS audit (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, tick_key TEXT, persona TEXT, councillor TEXT, tool TEXT, body TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, ts INTEGER NOT NULL, kind TEXT NOT NULL, body TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS routines (id TEXT PRIMARY KEY, owner TEXT, body TEXT NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS routine_runs (id INTEGER PRIMARY KEY AUTOINCREMENT, routine_id TEXT NOT NULL, at TEXT NOT NULL, ok INTEGER, body TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS council_state (id TEXT PRIMARY KEY, body TEXT NOT NULL, updated_at INTEGER NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS cost (day TEXT PRIMARY KEY, body TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at INTEGER NOT NULL)`,   // tick:last and other single pointers
  `CREATE INDEX IF NOT EXISTS audit_ts ON audit (ts)`, `CREATE INDEX IF NOT EXISTS events_ts ON events (ts)`, `CREATE INDEX IF NOT EXISTS runs_rid ON routine_runs (routine_id, id)`
];

export class AsgardLedger extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.context=ctx; this.environment=env;
    this.sql = ctx.storage.sql;
    this.ready = false;
  }
  init() { if (this.ready) return; for (const s of SCHEMA) this.sql.exec(s); this.ready = true; }
  rows(cursor) { return cursor.toArray ? cursor.toArray() : [...cursor]; }
  // ---- one entry point: { op, ...args } → JSON
  async fetch(request) {
    this.init();
    let body; try { body = await request.json(); } catch (e) { return Response.json({ ok: false, error: 'bad json' }, { status: 400 }); }
    try { return Response.json({ ok: true, result: await this.op(body) }); }
    catch (e) { return Response.json({ ok: false, error: String(e && e.message || e) }, { status: 500 }); }
  }
  async op(b) {
    const now = Date.now();
    switch (b.op) {
      case 'execution': return this.context.blockConcurrencyWhile(()=>executionState({get:key=>this.op({op:'get',key}),put:(key,value)=>this.op({op:'put',key,value})},b.action,b));
      case 'approvalClaim': return this.context.blockConcurrencyWhile(()=>approvalClaim({get:key=>this.op({op:'get',key}),put:(key,value)=>this.op({op:'put',key,value})},b.action,b));
      case 'conversationMirror': return this.context.blockConcurrencyWhile(() => mirrorConversation({get:key=>this.op({op:'get',key}),put:(key,value)=>this.op({op:'put',key,value}),kv:this.environment.RAYVEN_KV},b.key,b.raw));
      case 'ping': { const t = this.rows(this.sql.exec(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)); return { tables: t.map(r => r.name), at: now }; }
      case 'putTick': this.sql.exec(`INSERT OR REPLACE INTO tick (key, at, body) VALUES (?, ?, ?)`, b.key, b.at || new Date(now).toISOString(), JSON.stringify(b.body)); return { written: 1 };
      case 'recentTicks': return this.rows(this.sql.exec(`SELECT body FROM tick ORDER BY key DESC LIMIT ?`, Math.max(1, Math.min(200, Number(b.n) || 12)))).map(r => JSON.parse(r.body));
      case 'ticksForDay': return this.rows(this.sql.exec(`SELECT body FROM tick WHERE key LIKE ? ORDER BY key`, `tick:${b.day}:%`)).map(r => JSON.parse(r.body));
      case 'putAudit': { let n = 0; for (const a of b.lines || []) { this.sql.exec(`INSERT INTO audit (ts, tick_key, persona, councillor, tool, body) VALUES (?, ?, ?, ?, ?, ?)`, Number(a.ts) || now, b.tickKey || null, a.persona || null, a.councillor || null, a.tool || null, JSON.stringify(a)); n++; } return { written: n }; }
      case 'recentAudit': return this.rows(this.sql.exec(`SELECT body FROM audit ORDER BY id DESC LIMIT ?`, Math.max(1, Math.min(500, Number(b.n) || 50)))).map(r => JSON.parse(r.body));
      case 'putEvents': { let n = 0; for (const e of b.events || []) { this.sql.exec(`INSERT INTO events (ts, kind, body) VALUES (?, ?, ?)`, Number(e.ts) || now, String(e.event || e.kind || ''), JSON.stringify(e)); n++; } return { written: n }; }
      case 'putRoutine': this.sql.exec(`INSERT OR REPLACE INTO routines (id, owner, body, updated_at) VALUES (?, ?, ?, ?)`, b.id, b.owner || null, JSON.stringify(b.body), now); return { written: 1 };
      case 'getRoutine': { const r = this.rows(this.sql.exec(`SELECT body FROM routines WHERE id = ?`, b.id))[0]; return r ? JSON.parse(r.body) : null; }
      case 'listRoutines': return this.rows(this.sql.exec(`SELECT id, owner, body FROM routines ORDER BY id`)).map(r => { const j = JSON.parse(r.body); return { id: r.id, owner: r.owner, name: j.name, enabled: j.enabled !== false, deleted: !!j.deleted }; });
      case 'putRun': this.sql.exec(`INSERT INTO routine_runs (routine_id, at, ok, body) VALUES (?, ?, ?, ?)`, b.routineId, (b.run && b.run.at) || new Date(now).toISOString(), b.run && b.run.ok ? 1 : 0, JSON.stringify(b.run || {})); return { written: 1 };
      case 'runs': return this.rows(this.sql.exec(`SELECT body FROM routine_runs WHERE routine_id = ? ORDER BY id DESC LIMIT ?`, b.routineId, Math.max(1, Math.min(100, Number(b.n) || 20)))).map(r => JSON.parse(r.body));
      case 'putCouncil': this.sql.exec(`INSERT OR REPLACE INTO council_state (id, body, updated_at) VALUES (?, ?, ?)`, b.id, JSON.stringify(b.body), now); return { written: 1 };
      case 'getCouncil': { const r = this.rows(this.sql.exec(`SELECT body FROM council_state WHERE id = ?`, b.id))[0]; return r ? JSON.parse(r.body) : null; }
      case 'putCost': this.sql.exec(`INSERT OR REPLACE INTO cost (day, body) VALUES (?, ?)`, b.day, JSON.stringify(b.body)); return { written: 1 };
      case 'costDays': return this.rows(this.sql.exec(`SELECT day, body FROM cost ORDER BY day DESC LIMIT ?`, Math.max(1, Math.min(90, Number(b.n) || 7)))).map(r => ({ day: r.day, ...JSON.parse(r.body) }));
      case 'put': this.sql.exec(`INSERT OR REPLACE INTO kv (key, value, updated_at) VALUES (?, ?, ?)`, b.key, JSON.stringify(b.value), now); return { written: 1 };
      case 'get': { const r = this.rows(this.sql.exec(`SELECT value FROM kv WHERE key = ?`, b.key))[0]; return r ? JSON.parse(r.value) : null; }
      case 'counts': { const out = {}; for (const t of ['tick', 'audit', 'events', 'routines', 'routine_runs', 'council_state', 'cost', 'kv']) out[t] = this.rows(this.sql.exec(`SELECT COUNT(*) AS n FROM ${t}`))[0].n; out.databaseSize = this.ctx.storage.sql.databaseSize; return out; }
      default: throw new Error(`unknown op ${b.op}`);
    }
  }
}
