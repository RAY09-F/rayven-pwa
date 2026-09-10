import {costLine} from './cost.js';
import {spoolPush} from './conversation.js';
import {tickLog} from './tick.js';

export function logUsage(model, usage, source='chat', {persist=false,meta=null,persona=null,batch=false}={}) {
  if(!usage)return;
  const row={model,source,input_tokens:Number(usage.input_tokens)||0,output_tokens:Number(usage.output_tokens)||0,
    cache_creation_input_tokens:Number(usage.cache_creation_input_tokens)||0,cache_read_input_tokens:Number(usage.cache_read_input_tokens)||0};
  console.log('ANTHROPIC_USAGE',row);
  if(persist){const line=costLine({model,usage,source,persona,batch});if(meta)spoolPush(meta,'cost',line);else tickLog('cost',line);}
  return row;
}
