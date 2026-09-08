import {httpFetch,publicHostCheck} from '../lib/http.js';
import {capToolResult} from '../lib/tool-discovery.js';
export const field=(description,type='string')=>({type,description});
export function readTool({name,description,group='research',properties={},required=[],example={},key,enable,request,select=value=>value}) {
 return {name,description,group,taint:true,defer_loading:true,input_examples:[example],input_schema:{type:'object',properties:{...properties,response_format:{type:'string',enum:['concise','full']}},required,additionalProperties:false},async run(env,input={}){
  if(key&&!env[key])return `${name}: ${key} is not configured. No request was made.`;
  if(enable&&env[enable]!=='true')return `${name}: disabled until its free allowance and account setup are verified. No request was made.`;
  for(const name of required)if(input[name]==null||input[name]==='')return `Missing required input: ${name}.`;
  let spec;try{spec=request(env,input);}catch(error){return `${name}: ${error.message}`;}
  if(spec.target){const guard=publicHostCheck(spec.target);if(!guard.ok)return `${name}: target refused (${guard.why}).`;}
  const response=await httpFetch(env,spec.url,{...spec,cacheSeconds:spec.headers?0:300});
  if(!response.ok)return `${name}: request failed (HTTP ${response.status || 'unavailable'}).`;
  try{const data=select(response.json??response.text,input);if(data===undefined||response.json?.success===false||response.json?.error)throw Error('Source failure');return capToolResult({source:new URL(spec.url).origin,data},input.response_format);}catch{return `${name}: the source returned an unexpected response.`;}
 }};
}
