// Scratch-only interpreter for the supplied design file, never shipped.
(() => {
 window.DCLogic=class {props={motion:false};setState(next){Object.assign(this.state,next);render();}};
 window.React={createRef:()=>({current:null})};
 const code=document.querySelector('script[data-dc-script]').textContent;
 const Component=new Function(code+';return Component;')(),component=new Component();
 const original=document.querySelector('x-dc'),template=original.cloneNode(true);
 const expr=(s,v)=>new Function('v','with(v){return ('+s+');}')(v);
 const value=(s,v)=>expr(s.replace(/^\s*{{|}}\s*$/g,''),v);
 function expand(node,v){
  if(node.nodeType===3){node.textContent=node.textContent.replace(/{{(.*?)}}/g,(_,s)=>expr(s,v)??'');return;}
  if(node.nodeType!==1)return;
  if(node.tagName==='SC-FOR'){const frag=document.createDocumentFragment();for(const item of value(node.getAttribute('list'),v)){for(const child of [...node.childNodes]){const copy=child.cloneNode(true);frag.append(copy);expand(copy,{...v,[node.getAttribute('as')]:item});}}node.replaceWith(frag);return;}
  if(node.tagName==='SC-IF'){if(!value(node.getAttribute('value'),v)){node.remove();return;}for(const c of [...node.childNodes])expand(c,v);node.replaceWith(...node.childNodes);return;}
  for(const a of [...node.attributes]){if(a.name==='ref'){value(a.value,v).current=node;node.removeAttribute(a.name);}else if(a.name.toLowerCase()==='onclick'){node.removeAttribute(a.name);node.onclick=value(a.value,v);}else if(a.value.includes('{{'))node.setAttribute(a.name,a.value.replace(/{{(.*?)}}/g,(_,s)=>expr(s,v)??''));}
  for(const child of [...node.childNodes])expand(child,v);
 }
 function render(){const copy=template.cloneNode(true);document.querySelector('x-dc').replaceWith(copy);const v=component.renderVals();for(const child of [...copy.childNodes])expand(child,v);component.apply();component.fit();}
 window.referenceRealm=realm=>component.setState({god:realm});render();
})();
