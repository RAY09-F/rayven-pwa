const label=value=>value.replace(/^(wb_|biz_|business_|creator_)/,'').replace(/([a-z])([A-Z])/g,'$1 $2').replaceAll('_',' ').replace(/^./,c=>c.toUpperCase());
const node=(tag,text)=>{const el=document.createElement(tag);if(text!=null)el.textContent=text;return el;};

// Destination links only. Opening a tool never runs it.
export function mountCommandMenu(body,{close,onAttention}){
  const root=node('div');root.className='command-menu';
  const caption=node('label','Find a place or tool');caption.htmlFor='command-search';
  const search=node('input');search.id='command-search';search.type='search';search.placeholder='Try website, quote, CSV, or Thor';search.autocomplete='off';
  const count=node('p');count.id='command-count';count.setAttribute('role','status');search.setAttribute('aria-describedby',count.id);
  const list=node('ul');list.id='command-results';list.setAttribute('aria-label','Destinations');
  const help=node('p','↑ ↓ to browse · Enter to open · Esc to close');help.className='command-help';
  const done=node('button','Close');done.type='button';done.addEventListener('click',close);
  const core=[
    {name:'Your attention',detail:'Return to what needs you',action:()=>{close();onAttention();}},
    ...['Thor','Loki','Odin'].map(name=>({name:name+'’s hall',detail:'Open your conversation',href:'/hall/#'+name.toLowerCase()})),
    {name:'Tool desk',detail:'Browse all 100 local tools',href:'/workshop/'},
    {name:'Service studio',detail:'Scope and quote a website or automation',href:'/workshop/services.html'},
    {name:'Website and automation sample',detail:'Explore a fictional service project',href:'/workshop/sample.html'},
    {name:'Field guide',detail:'Choose a useful workflow and learn the tools',href:'/workshop/guide.html'}
  ];
  let entries=core,loading=true,failed=false;
  function render(){
    const query=search.value.trim().toLowerCase();
    const tokens=query.split(/\s+/).filter(Boolean);
    const matches=entries.filter(item=>tokens.every(token=>[item.name,item.detail,item.key||'',item.aliases||''].join(' ').toLowerCase().includes(token)));
    const shown=matches.slice(0,12);list.replaceChildren();
    count.textContent=(loading?'Opening the tool list… · ':failed?'Tool list unavailable. Core destinations remain available. · ':'')+(matches.length>12?`Showing 12 of ${matches.length} matches. Type more to narrow them.`:`${matches.length} ${matches.length===1?'destination':'destinations'}`);
    for(const item of shown){const row=node('li'),control=node(item.href?'a':'button');control.setAttribute('aria-label',item.name);if(item.href)control.href=item.href;else{control.type='button';control.addEventListener('click',item.action);}control.append(node('strong',item.name),node('span',item.detail));row.append(control);list.append(row);}
    if(!shown.length)list.append(node('li','No matches. Try a tool name or a shorter phrase.'));
  }
  search.addEventListener('input',render);
  root.addEventListener('keydown',event=>{
    if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return;}
    const choices=[...list.querySelectorAll('a,button')];if(!choices.length)return;
    const index=choices.indexOf(document.activeElement);
    if(event.key==='ArrowDown'||event.key==='ArrowUp'){
      event.preventDefault();const next=event.key==='ArrowDown'?(index+1)%choices.length:(index<0?choices.length-1:(index-1+choices.length)%choices.length);choices[next].focus();
    }else if(event.key==='Enter'&&event.target===search){event.preventDefault();choices[0].click();}
  });
  root.append(caption,search,count,list,help,done);body.append(root);render();search.focus();
  Promise.all([import('../workshop/tools/catalog-business-lab.js'),import('../workshop/tools/catalog-workbench.js')]).then(modules=>{
    if(!root.isConnected)return;
    const aliases={business_project_quote:'website estimate',wb_web_meta_build:'website metadata',wb_dependency_order:'automation workflow'};
    entries=[...core,...modules.flatMap(m=>m.TOOLS).map(tool=>({name:label(tool.name),detail:label(tool.group)+' · '+tool.description,key:tool.name,aliases:aliases[tool.name]||'',href:'/workshop/#'+tool.name}))];loading=false;render();
  }).catch(()=>{if(!root.isConnected)return;loading=false;failed=true;render();});
}
