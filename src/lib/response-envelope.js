import {safeError} from './chat-diagnostics.js';
export function errorCategory(error,status=0) {
 const message=String(error?.message||error||'');
 if([401,403].includes(status))return 'auth';
 if(status===429 || /BUDGET_EXHAUSTED|quota|capacity reached/i.test(message))return 'quota';
 if([400,404,422].includes(status))return 'user';
 if(error?.name==='AbortError'||error?.name==='TimeoutError'||error instanceof TypeError||/network|timed out|fetch failed/i.test(message))return 'network';
 return 'logic';
}
export function withReleaseHeaders(handler) {
 return {
  ...handler,
  async fetch(request,env,ctx) {
   let response;
   try {response=await handler.fetch(request,env,ctx)}
   catch(error) {
    const category=errorCategory(error);
    console.error(JSON.stringify({event:'request_failed',category,reason:safeError(error)}));
    response=Response.json({error:'ASGARD could not complete this request. Please try again shortly.',category},{status:503});
   }
   const headers=new Headers(response.headers);
   headers.set('X-Asgard-Version',env.ASGARD_VERSION?.id||'local-unversioned');
   const expose=new Set((headers.get('Access-Control-Expose-Headers')||'').split(',').map(x=>x.trim()).filter(Boolean));
   expose.add('X-Asgard-Version');headers.set('Access-Control-Expose-Headers',[...expose].join(', '));
   return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
  }
 };
}
