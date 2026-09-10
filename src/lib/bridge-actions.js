import {readApproval,approvalRevision,editApproval,resolveApproval} from './approvals.js';
import {PERSONAS} from './personas.js';
const publicPersona=id=>Object.hasOwn(PERSONAS,id)&&!PERSONAS[id].hidden;
const editable=(key,spec)=>!/(password|secret|token|api.?key|credential)/i.test(key)&&['string','number','integer','boolean'].includes(spec.type);

export async function bridgeReview(env,{id,persona},definitions) {
  if(!publicPersona(persona))return {ok:false,message:'Unknown hall.'};
  const record=await readApproval(env,id,persona);
  if(!record||record.status!=='pending'||(!Number.isFinite(Date.parse(record.expiresAt))||Date.parse(record.expiresAt)<=Date.now()))return {ok:false,message:'This action is no longer waiting for review.'};
  const definition=definitions.find(t=>t.name===record.tool);
  if(!definition)return {ok:false,message:'This tool definition is unavailable. The proposal was not changed.'};
  const schema=definition.input_schema;
  const fields=Object.entries(schema.properties||{}).filter(([key,spec])=>editable(key,spec)).map(([key,spec])=>({
    key,label:spec.title||key.replaceAll('_',' '),description:spec.description||'',type:spec.type,
    options:spec.enum,required:schema.required?.includes(key)||false,value:record.input[key]??null
  }));
  return {ok:true,id,persona,revision:await approvalRevision(record),description:record.description,fields};
}

export async function bridgeAction(env,body,definitions,execute) {
  const {id,persona,decision,revision}=body||{};
  if(!publicPersona(persona)||!/^\d{4}$/.test(String(id))||!['approve','reject','edit'].includes(decision)||!/^[a-f0-9]{64}$/.test(revision||''))return {ok:false,message:'The action request is incomplete. Refresh and review it again.'};
  if(!env.LEDGER)return {ok:false,message:'Approval coordination is unavailable. Nothing was executed.'};
  if(decision!=='edit'){
    const result=await resolveApproval(env,id,decision,execute,{persona,revision,requireClaim:true});
    return {ok:result.ok,message:result.text,staged:!!result.staged};
  }
  const record=await readApproval(env,id,persona);
  if(!record)return {ok:false,message:'No matching approval exists.'};
  const schema=definitions.find(t=>t.name===record.tool)?.input_schema;
  if(!schema||!body.values||typeof body.values!=='object'||Array.isArray(body.values))return {ok:false,message:'No editable fields were provided.'};
  const input={...record.input};
  for(const [key,value] of Object.entries(body.values)) {
    const spec=schema.properties?.[key];
    if(!spec||!editable(key,spec))return {ok:false,message:'An unsupported field was included. The proposal was not changed.'};
    if(value===null&&!schema.required?.includes(key)){delete input[key];continue;}
    if(spec.type==='string'&&(typeof value!=='string'||value.length>20000||schema.required?.includes(key)&&!value.trim())
      ||['number','integer'].includes(spec.type)&&(!Number.isFinite(value)||spec.type==='integer'&&!Number.isInteger(value))
      ||spec.type==='boolean'&&typeof value!=='boolean'
      ||spec.enum&&!spec.enum.includes(value)
      ||spec.minimum!=null&&value<spec.minimum||spec.maximum!=null&&value>spec.maximum
      ||spec.minLength!=null&&value.length<spec.minLength||spec.maxLength!=null&&value.length>spec.maxLength)return {ok:false,message:'Check the value for '+key.replaceAll('_',' ')+'.'};
    input[key]=value;
  }
  const result=await editApproval(env,id,persona,input,revision);
  return {ok:result.ok,message:result.text};
}
