import test from 'node:test';import assert from 'node:assert/strict';import {lockIntent,PALETTES} from '../public/ui/command-identity.js';
test('direct lock-in and exit phrases, without treating quotes or negation as commands',()=>{
  for(const s of ['lock in','Thor, lock in','Hey Loki, lock in on this task','Odin lock-in','I want you to lock in','please lock in','lock in and do not stop','I need you to lock in'])assert.equal(lockIntent(s),true,s);
  for(const s of ['stand down','Thor, stand down','unlock','exit lock in'])assert.equal(lockIntent(s),false,s);
  for(const s of ['do not lock in',"don't lock in",'what does lock in mean?','He said lock in','write “lock in”','ordinary request'])assert.equal(lockIntent(s),null,s);
});
test('palettes have bounded channels and distinct red-white, monochrome and violet lock modes',()=>{
  for(const p of Object.values(PALETTES)){for(const k of ['bg','deep','mid','main','hot','rim','amb1','amb2']){assert.equal(p[k].length,k.startsWith('amb')?4:3);assert.ok(p[k].every(n=>Number.isFinite(n)&&n>=0&&n<=1));}}
  assert.deepEqual(PALETTES.locked.hot,[1,1,1]);assert.deepEqual(PALETTES.locked.rim,[1,1,1]);assert.ok(PALETTES.locked.main[0]>10*PALETTES.locked.main[1]);
  assert.ok(PALETTES.thor.main[2]>PALETTES.thor.main[0]);assert.ok(PALETTES.loki.main[1]>PALETTES.loki.main[0]);assert.ok(PALETTES.odin.main[0]>PALETTES.odin.main[2]);
  for(const channels of Object.values(PALETTES.lockedLoki))assert.ok(channels.slice(0,3).every(n=>n===channels[0]));
  assert.deepEqual(PALETTES.lockedOdin.hot,[1,1,1]);assert.ok(PALETTES.lockedOdin.main[2]>PALETTES.lockedOdin.main[1]);
});
