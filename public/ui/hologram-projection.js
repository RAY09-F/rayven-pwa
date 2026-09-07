// Canvas fallback projects the very same 3D buffers through the Three.js camera.
// No concept image, screen-space replacement character or fabricated audio data.
export function createParticleProjection(THREE,canvas){
 const ctx=canvas.getContext('2d',{alpha:true});if(!ctx)throw Error('Canvas projection unavailable');
 const matrix=new THREE.Matrix4(),view=new THREE.Matrix4();let width=1,height=1,dpr=1;
 const cachedColors=new WeakMap();
 function resize(w,h,ratio=1){width=w;height=h;dpr=Math.min(ratio,1.25);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);canvas.style.width=w+'px';canvas.style.height=h+'px';}
 function project(array,i,m){const x=array[i],y=array[i+1],z=array[i+2],inv=1/(m[3]*x+m[7]*y+m[11]*z+m[15]);return [(m[0]*x+m[4]*y+m[8]*z+m[12])*inv,(m[1]*x+m[5]*y+m[9]*z+m[13])*inv,(m[2]*x+m[6]*y+m[10]*z+m[14])*inv];}
 function render(scene,camera,{time=0,state='idle',animated=false,persona='thor'}={}){
  scene.updateMatrixWorld(true);camera.updateMatrixWorld();view.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);ctx.globalCompositeOperation='lighter';
  const accent=persona==='thor'?'100,212,255':persona==='loki'?'247,218,103':'251,195,120';
  // A quiet projector field supports the model; it is not a data visualization.
  const glow=ctx.createRadialGradient(width*.5,height*.55,10,width*.5,height*.55,height*.46);glow.addColorStop(0,`rgba(${accent},.045)`);glow.addColorStop(1,`rgba(${accent},0)`);ctx.fillStyle=glow;ctx.fillRect(0,0,width,height);
  let drawn=0;
  scene.traverseVisible(object=>{
   if(!object.geometry||!object.material)return;
   if(!object.isPoints&&!object.isLineSegments&&!object.isLine)return;
   const positions=object.geometry.attributes.position;if(!positions)return;
   matrix.multiplyMatrices(view,object.matrixWorld);const m=matrix.elements;
   const material=Array.isArray(object.material)?object.material[0]:object.material;
   if(object.isPoints){
    const color=object.geometry.attributes.color;let colors=cachedColors.get(object.geometry);
    if(!colors){colors=[];const c=new THREE.Color();for(let i=0;i<positions.count;i++){if(color)c.fromBufferAttribute(color,i);else c.copy(material.color||new THREE.Color('#94dfff'));c.convertLinearToSRGB();colors.push(`${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)}`);}cachedColors.set(object.geometry,colors);}
    const count=Math.min(positions.count,object.geometry.drawRange.count);const projected=[];
    for(let i=0;i<count;i++){const p=project(positions.array,i*3,m);if(!p.every(Number.isFinite)||p[2]<-1||p[2]>1||Math.abs(p[0])>1.04||Math.abs(p[1])>1.04)continue;projected.push([p[2],(p[0]+1)*width/2,(1-p[1])*height/2,i]);}
    projected.sort((a,b)=>b[0]-a[0]);
    const opacity=material.opacity??1;
    for(const [z,x,y,i]of projected){const size=(i%7===0?1.7:1.15)*Math.max(.8,height/600);const scan=animated?.72+.28*Math.sin(y*.085-time*2):.86;ctx.fillStyle=`rgba(${colors[i]},${Math.min(.9,opacity*.78*scan)})`;ctx.fillRect(x,y,size,size);if(i%23===0){ctx.fillStyle=`rgba(${colors[i]},.06)`;ctx.fillRect(x-2,y-2,5,5);}drawn++;}
   }else{
    const c=(material.color||new THREE.Color('#7bcaff')).clone().convertLinearToSRGB();ctx.strokeStyle=`rgba(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)},${Math.min(.3,material.opacity??.22)})`;ctx.lineWidth=.6;ctx.beginPath();
    const step=object.isLineSegments?2:1;for(let i=0;i<positions.count-1;i+=step){const a=project(positions.array,i*3,m),b=project(positions.array,(i+1)*3,m);if(!a.every(Number.isFinite)||!b.every(Number.isFinite)||Math.abs(a[0])>1.1||Math.abs(b[0])>1.1||a[2]<-1||a[2]>1||b[2]<-1||b[2]>1)continue;ctx.moveTo((a[0]+1)*width/2,(1-a[1])*height/2);ctx.lineTo((b[0]+1)*width/2,(1-b[1])*height/2);}ctx.stroke();
   }
  });
  if(animated){const y=((time*.12)%1)*height;ctx.fillStyle=`rgba(${accent},.07)`;ctx.fillRect(0,y,width,1);}
  ctx.globalCompositeOperation='source-over';return drawn;
 }
 return {resize,render,dispose(){ctx.clearRect(0,0,canvas.width,canvas.height);}};
}
