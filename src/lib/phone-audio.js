// Short-lived phone media only. The existing R2 binding gives immediate
// read-after-write visibility when Twilio requests a just-generated reply.
const PREFIX='phone-audio/';
export async function storePhoneAudio(env,bytes,ttlSeconds=900){
 if(!env.CLIPS)return null;
 const id='r2'+String(Date.now()+ttlSeconds*1000)+crypto.randomUUID().replaceAll('-','').slice(0,20);
 await env.CLIPS.put(PREFIX+id,bytes,{httpMetadata:{contentType:'audio/mpeg'}});
 return id;
}
export async function readPhoneAudio(env,id){
 if(!/^r2\d{13}[a-f0-9]{20}$/.test(id)||Number(id.slice(2,15))<=Date.now()||!env.CLIPS)return new Response('gone',{status:404});
 const obj=await env.CLIPS.get(PREFIX+id);if(!obj)return new Response('gone',{status:404});
 return new Response(obj.body,{headers:{'Content-Type':'audio/mpeg','Cache-Control':'private, no-store','X-Robots-Tag':'noindex','X-Content-Type-Options':'nosniff'}});
}
export async function cleanupPhoneAudio(env,now=Date.now()){
 if(!env.CLIPS)return {skipped:true};
 const page=await env.CLIPS.list({prefix:PREFIX,limit:1000});
 const keys=page.objects.map(o=>o.key).filter(k=>/^phone-audio\/r2\d{13}[a-f0-9]{20}$/.test(k)&&Number(k.slice(PREFIX.length+2,PREFIX.length+15))<=now);
 if(keys.length)await env.CLIPS.delete(keys);
 return {deleted:keys.length};
}
