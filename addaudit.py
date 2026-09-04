#!/usr/bin/env python3
# Phase 7 — wire the audit trail into the tool loop.
#
# This edits YOUR src/lib/tools.js in place rather than replacing it, because
# the file on your machine is the source of truth and mine is not. Every anchor
# below was verified against your DEPLOYED worker before this was written.
#
# It verifies every anchor before changing anything, and writes nothing at all
# unless all of them match exactly once. Safe to run twice — it detects work it
# has already done and stops.
import io, os, sys

P = 'src/lib/tools.js'
if not os.path.exists(P):
    print('FAILED — run this from ~/rayven-pwa (no src/lib/tools.js here)'); sys.exit(1)

s = io.open(P, encoding='utf-8').read()

if 'commitTrace' in s:
    print('Already wired — nothing to do. Safe to deploy.'); sys.exit(0)

EDITS = [
 ('import',
  "import { checkPermission } from './permissions.js';",
  "import { checkPermission } from './permissions.js';\n"
  "import { newTrace, record, recordTool, commitTrace, auditRecent, auditTrace, auditWhy } from './audit.js';"),

 ('start the trace',
  "  let tainted = !!startTainted;\n  const taintSources = [];",
  "  let tainted = !!startTainted;\n  const taintSources = [];\n"
  "  // One trace per turn, one KV write at the end. taintCause holds the index of\n"
  "  // the event that first brought untrusted content in; every consequential\n"
  "  // action after it records that index. That single field is the causal chain.\n"
  "  const trace = newTrace({ personaId, channel: 'chat', startTainted });\n"
  "  let taintCause = 0;"),

 ('record tool runs and taint',
  "              if (marksTainted(blk.name)) {\n"
  "                if (!tainted) tainted = true;\n"
  "                if (!taintSources.includes(blk.name)) taintSources.push(blk.name);\n"
  "                toolResult = wrapUntrusted(blk.name, toolResult);\n"
  "              }",
  "              const evIdx = await recordTool(trace, blk.name, blk.input, toolResult,\n"
  "                { tainted: marksTainted(blk.name), cause: tainted ? taintCause : 0 });\n"
  "              if (marksTainted(blk.name)) {\n"
  "                if (!tainted) { tainted = true; taintCause = evIdx; }\n"
  "                if (!taintSources.includes(blk.name)) taintSources.push(blk.name);\n"
  "                toolResult = wrapUntrusted(blk.name, toolResult);\n"
  "              }"),

 ('record held confirmations',
  "            toolResult = describeAction(blk.name, blk.input, tainted, taintSources)",
  "            record(trace, 'policy', blk.name, {\n"
  "              note: tainted ? 'held for confirmation - session had read untrusted content' : 'held for confirmation',\n"
  "              tainted: tainted, cause: taintCause, ok: false });\n"
  "            toolResult = describeAction(blk.name, blk.input, tainted, taintSources)"),

 ('record tool failures',
  "            } catch (err) {\n"
  "              toolResult = `That tool failed: ${err && err.message ? err.message : String(err)}`;\n"
  "            }",
  "            } catch (err) {\n"
  "              toolResult = `That tool failed: ${err && err.message ? err.message : String(err)}`;\n"
  "              record(trace, 'error', blk.name, { note: String(err && err.message || err).slice(0, 120), ok: false, cause: tainted ? taintCause : 0 });\n"
  "            }"),

 ('commit on API failure',
  "    if (!result.ok) return result;",
  "    if (!result.ok) { record(trace, 'error', 'anthropic', { note: `HTTP ${result.status || '?'}`, ok: false }); await commitTrace(env, trace); return result; }"),

 ('commit on the way out',
  "      continue;\n    }\n    return result;\n  }\n  return lastResult;",
  "      continue;\n    }\n    await commitTrace(env, trace);\n    return result;\n  }\n  await commitTrace(env, trace);\n  return lastResult;"),

 ('dispatch the three audit tools',
  "    case 'allow_host':",
  "    case 'audit_recent': return await auditRecent(env, input);\n"
  "    case 'audit_turn': return await auditTrace(env, input);\n"
  "    case 'audit_why': return await auditWhy(env, input);\n"
  "    case 'allow_host':"),

 ('declare the three audit tools',
  "  { name: 'list_allowed_hosts',",
  "  { name: 'audit_recent', description: 'List recent turns from the audit trail, newest first, flagging which ones read untrusted content. Use when Rayan asks what has been happening lately or whether something actually ran.', input_schema: { type: 'object', properties: { limit: { type: 'number' } } } },\n"
  "  { name: 'audit_turn', description: 'Replay one recorded turn event by event - every tool called in order, with argument shapes, byte counts and what caused what. Takes the short id from audit_recent.', input_schema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] } },\n"
  "  { name: 'audit_why', description: \"Answer 'what made it do that'. For a given tool, show every recorded use and whether untrusted content had been read first, naming the pages. Use this whenever Rayan asks why an action happened.\", input_schema: { type: 'object', properties: { tool: { type: 'string' } } } },\n"
  "  { name: 'list_allowed_hosts',"),
]

problems = []
for label, old, _ in EDITS:
    n = s.count(old)
    if n != 1:
        problems.append('  %-32s found %d times, expected exactly 1' % (label, n))

if problems:
    print('FAILED - do not deploy. These anchors did not match your file:')
    print('\n'.join(problems))
    print('\nNothing was changed. Send this output back and I will re-cut the patch.')
    sys.exit(1)

for label, old, new in EDITS:
    s = s.replace(old, new, 1)
    print('  ok  ' + label)

io.open(P, 'w', encoding='utf-8').write(s)
print('\nRESULT: OK - src/lib/tools.js updated. Deploy now.')
