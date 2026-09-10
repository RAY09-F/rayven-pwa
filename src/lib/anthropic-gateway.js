// All Anthropic paths share routing. Gateway stays off until its spend limit is verified.
const DIRECT='https://api.anthropic.com';
export async function anthropicFetch(env,path,options={}) {
 if(!path.startsWith('/v1/messages')||path.includes('..')||/[?#]/.test(path))throw Error('Invalid Anthropic API path.');
 const direct=env.ANTHROPIC_DIRECT_BASE||DIRECT;
 if(new URL(direct).origin!==DIRECT||new URL(direct).pathname!=='/')throw Error('Invalid direct provider host.');
 if(env.AI_GATEWAY_ENABLED!=='true')return fetch(direct+path,options);
 if(env.AI_GATEWAY_SPEND_LIMIT_VERIFIED!=='true')throw Error('AI Gateway has no verified spend limit.');
 const gateway=new URL(env.ANTHROPIC_GATEWAY_BASE);
 if(gateway.origin!=='https://gateway.ai.cloudflare.com'||!/^\/v1\/[a-f0-9]{32}\/[A-Za-z0-9_-]+\/anthropic$/.test(gateway.pathname)||gateway.search||gateway.hash||gateway.username||gateway.password)throw Error('Invalid AI Gateway URL.');
 const headers=new Headers(options.headers);headers.set('cf-aig-collect-log-payload','false');headers.set('cf-aig-skip-cache','true');
 const response=await fetch(gateway.href+path,{...options,headers});
 // Only an explicit missing route is safe to fail over. Never bypass a 429 spend cap,
 // retry an ambiguous network failure, or replay a partially received streamed answer.
 if(response.status===404&&env.ANTHROPIC_DIRECT_FALLBACK==='true'){
  await response.body?.cancel();return fetch(direct+path,options);
 }
 return response;
}
