export async function paperRpc(env,op,args={}){
  const stub=env.PAPER_LEDGER.get(env.PAPER_LEDGER.idFromName('paper-v1'));
  const r=await stub.fetch('https://paper.internal/',{method:'POST',body:JSON.stringify({op,...args})});
  const data=await r.json();if(!r.ok)throw Error(data.error||'Paper ledger unavailable');return data;
}
export function paperEnvironment(env){
  if(!env.PAPER_LEDGER||env._paperWrapped)return env;
  const kv=env.RAYVEN_KV;
  return {...env,_paperWrapped:true,RAYVEN_KV:{
    get:(key,...args)=>key.startsWith('paper:')?paperRpc(env,'get',{key}).then(x=>x.value):kv.get(key,...args),
    put:(key,value,...args)=>key.startsWith('paper:')?paperRpc(env,'put',{key,value}):kv.put(key,value,...args),
    delete:(key,...args)=>key.startsWith('paper:')?paperRpc(env,'delete',{key}):kv.delete(key,...args),
    list:(...args)=>kv.list(...args)
  }};
}
