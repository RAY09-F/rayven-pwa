import {ledger} from './ledger.js';
export async function claimTelegramUpdate(env,persona,updateId) {
  if(!Number.isSafeInteger(updateId)||updateId<0)throw new Error('Invalid Telegram update ID');
  // Honor earlier KV receipts during rollout; new claims require atomic storage.
  if(await env.RAYVEN_KV.get(`tg:update:${persona}:${updateId}`))return false;
  return (await ledger.claimTelegramUpdate(env,persona,updateId)).claimed;
}
