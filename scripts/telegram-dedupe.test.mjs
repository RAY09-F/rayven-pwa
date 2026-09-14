import test from 'node:test';
import assert from 'node:assert/strict';
import {claimTelegramUpdate} from '../src/lib/telegram-dedupe.js';
test('honors existing receipts without allocating another model turn',async()=>{
 assert.equal(await claimTelegramUpdate({RAYVEN_KV:{get:async()=> '1'}},'thor',5),false);
});
test('missing atomic store fails closed; invalid updates never access storage',async()=>{
 await assert.rejects(claimTelegramUpdate({RAYVEN_KV:{get:async()=>null}},'thor',5),/LEDGER/);
 await assert.rejects(claimTelegramUpdate({},'thor',undefined),/Invalid/);
});
