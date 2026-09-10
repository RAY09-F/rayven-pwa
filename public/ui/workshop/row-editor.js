// Keep structured rows approachable; the hidden JSON field feeds the same schema.
export function rowEditor(wrap,input,schema,label){
  if(schema.type!=='array'||schema.items?.type!=='object'||!schema.items.properties||Object.values(schema.items.properties).some(s=>!['string','number','integer','boolean'].includes(s.type)))return;
  const editor=document.createElement('div');editor.className='row-editor';
  const rows=document.createElement('div'),add=document.createElement('button');add.type='button';add.className='secondary';add.textContent='Add row';editor.append(rows,add);input.hidden=true;input.required=false;wrap.append(editor);
  const sync=()=>{input.value=JSON.stringify([...rows.children].map(row=>Object.fromEntries([...row.querySelectorAll('[data-column]')].map(e=>[e.dataset.column,e.type==='checkbox'?e.checked:e.type==='number'?e.value===''?null:Number(e.value):e.value]))));input.dispatchEvent(new Event('input',{bubbles:true}));};
  const append=(values={})=>{if(rows.children.length>=(schema.maxItems||100))return;const row=document.createElement('fieldset'),legend=document.createElement('legend');legend.textContent='Item '+(rows.children.length+1);row.append(legend);
    for(const [key,s] of Object.entries(schema.items.properties)){const caption=document.createElement('label');caption.textContent=label(key);const field=document.createElement('input');field.dataset.column=key;field.type=s.type==='boolean'?'checkbox':['number','integer'].includes(s.type)?'number':'text';field.step=s.type==='integer'?'1':'any';if(s.minimum!=null)field.min=s.minimum;if(s.maximum!=null)field.max=s.maximum;if(s.maxLength)field.maxLength=s.maxLength;if(field.type==='checkbox')field.checked=!!values[key];else field.value=values[key]??'';field.addEventListener('input',sync);caption.append(field);row.append(caption);}
    const remove=document.createElement('button');remove.type='button';remove.className='secondary';remove.textContent='Remove row';remove.addEventListener('click',()=>{row.remove();[...rows.children].forEach((r,i)=>r.querySelector('legend').textContent='Item '+(i+1));sync();});row.append(remove);rows.append(row);
  };
  const restore=()=>{rows.replaceChildren();let values=[];try{values=JSON.parse(input.value||'[]');}catch{}if(!Array.isArray(values))values=[];for(const row of values)append(row);if(!rows.children.length)append();};
  add.addEventListener('click',()=>{append();sync();});input.addEventListener('restore-editor',restore);restore();
}
