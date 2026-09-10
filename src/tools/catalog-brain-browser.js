// Public cloud browsing supplements the separately installed, logged-in Chrome extension.
import {httpFetch,publicHostCheck} from '../lib/http.js';
import {capToolResult} from '../lib/tool-discovery.js';
function tool(screenshot){const name=screenshot?'browser_cloud_screenshot':'browser_cloud_read';return{name,group:'browser',taint:true,defer_loading:true,input_examples:[{url:'https://example.com'}],description:screenshot?'Capture a public page in Cloudflare Browser Run; cannot see your logged-in Chrome. Disabled until a scoped token and free allowance are verified.':'Read a JavaScript-rendered public page with Cloudflare Browser Run. Separate from your logged-in Chrome; disabled until setup and allowance verification.',input_schema:{type:'object',properties:{url:{type:'string',description:'Public HTTPS page'}},required:['url'],additionalProperties:false},async run(env,{url}={}){
 if(env.BROWSER_CLOUD_ENABLED!=='true')return 'Cloud browser is disabled. No request was made.';
 if(!env.BROWSER_RUN_TOKEN||! /^[a-f0-9]{32}$/i.test(env.CLOUDFLARE_ACCOUNT_ID||''))return 'Cloud browser needs a scoped Browser Rendering token and account ID.';
 const guard=publicHostCheck(url);if(!guard.ok)return `Cloud browser refused the target: ${guard.why}.`;
 const endpoint=screenshot?'screenshot':'markdown';
 const response=await httpFetch(env,`https://api.cloudflare.com/client/v4/accounts/${env.CLOUDFLARE_ACCOUNT_ID}/browser-rendering/${endpoint}`,{method:'POST',headers:{Authorization:`Bearer ${env.BROWSER_RUN_TOKEN}`,'content-type':'application/json'},body:JSON.stringify({url,gotoOptions:{waitUntil:'domcontentloaded',timeout:8000},...(screenshot?{viewport:{width:1024,height:768},screenshotOptions:{type:'jpeg',quality:60,fullPage:false}}:{})}),binary:screenshot,maxBytes:1024*1024});
 if(!response.ok)return `Cloud browser failed (HTTP ${response.status||'unavailable'}).`;
 if(!screenshot){if(!response.json?.success||typeof response.json.result!=='string')return 'Cloud browser returned an unexpected response.';return capToolResult(response.json.result);}
 if(!/image\/jpeg/.test(response.contentType))return 'Cloud browser returned an unexpected image format.';
 let binary='';for(let n=0;n<response.bytes.length;n+=8192)binary+=String.fromCharCode(...response.bytes.subarray(n,n+8192));
 return [{type:'text',text:`Public-page screenshot: ${guard.url.origin}`},{type:'image',source:{type:'base64',media_type:'image/jpeg',data:btoa(binary)}}];
}};}
export const TOOLS=[tool(false),tool(true)];
