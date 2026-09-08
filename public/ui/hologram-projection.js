// Explicit software fallback: the same modeled triangles, face normals, camera
// and particles as WebGL. Painter shading + a small depth buffer preserve mass.
export function createParticleProjection(THREE,canvas){
 const ctx=canvas.getContext('2d',{alpha:true});if(!ctx)throw Error('Canvas projection unavailable');
 const matrix=new THREE.Matrix4(),view=new THREE.Matrix4();let width=1,height=1,dpr=1,depthWidth=1,depthHeight=1,depth=new Float32Array(1),disposed=false;
 const cachedColors=new WeakMap(),light=new THREE.Vector3(-.6,.8,1).normalize();
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),normal=new THREE.Vector3(),edge=new THREE.Vector3();
 function resize(w,h,ratio=1){width=Math.max(1,Number.isFinite(w)?w:1);height=Math.max(1,Number.isFinite(h)?h:1);dpr=Math.min(Math.max(.5,Number.isFinite(ratio)?ratio:1),1.25);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);canvas.style.width=width+'px';canvas.style.height=height+'px';depthWidth=Math.ceil(width/2);depthHeight=Math.ceil(height/2);depth=new Float32Array(depthWidth*depthHeight);}
 function project(array,i,m){const x=array[i],y=array[i+1],z=array[i+2],inv=1/(m[3]*x+m[7]*y+m[11]*z+m[15]);return [(m[0]*x+m[4]*y+m[8]*z+m[12])*inv,(m[1]*x+m[5]*y+m[9]*z+m[13])*inv,(m[2]*x+m[6]*y+m[10]*z+m[14])*inv];}
 const valid=p=>p.every(Number.isFinite)&&p[2]>=-1&&p[2]<=1;
 const screen=p=>[(p[0]+1)*width/2,(1-p[1])*height/2,p[2]];
 function blocked(p){const x=Math.floor(p[0]/2),y=Math.floor(p[1]/2);return x>=0&&y>=0&&x<depthWidth&&y<depthHeight&&p[2]>depth[y*depthWidth+x]+.00010;}
 function rasterDepth(p,q,r,area){
  const minX=Math.max(0,Math.floor(Math.min(p[0],q[0],r[0])/2)),maxX=Math.min(depthWidth-1,Math.ceil(Math.max(p[0],q[0],r[0])/2));
  const minY=Math.max(0,Math.floor(Math.min(p[1],q[1],r[1])/2)),maxY=Math.min(depthHeight-1,Math.ceil(Math.max(p[1],q[1],r[1])/2));
  for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
   const px=x*2+1,py=y*2+1,u=((q[0]-px)*(r[1]-py)-(q[1]-py)*(r[0]-px))/area,v=((r[0]-px)*(p[1]-py)-(r[1]-py)*(p[0]-px))/area,w=1-u-v;
   if(u<-.001||v<-.001||w<-.001)continue;const z=u*p[2]+v*q[2]+w*r[2],i=y*depthWidth+x;if(z<depth[i])depth[i]=z;
  }
 }
 function render(scene,camera){
  if(disposed)return 0;
  scene.updateMatrixWorld(true);camera.updateMatrixWorld();view.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);depth.fill(Infinity);
  ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,width,height);ctx.globalCompositeOperation='source-over';
  const surfaces=[],details=[];
  scene.traverseVisible(object=>{
   if(!object.geometry||!object.material)return;
   const positions=object.geometry.attributes.position;if(!positions)return;
   const material=Array.isArray(object.material)?object.material[0]:object.material;
   matrix.multiplyMatrices(view,object.matrixWorld);const m=matrix.elements;
   if(!object.isMesh){if(object.isPoints||object.isLine)details.push(object);return;}
   const idx=object.geometry.index,count=idx?idx.count:positions.count;
   for(let i=0;i<count;i+=3){
    const ia=idx?idx.getX(i):i,ib=idx?idx.getX(i+1):i+1,ic=idx?idx.getX(i+2):i+2;
    const raw=[project(positions.array,ia*3,m),project(positions.array,ib*3,m),project(positions.array,ic*3,m)];if(!raw.every(valid))continue;
    const [p,q,r]=raw.map(screen),area=(q[0]-p[0])*(r[1]-p[1])-(q[1]-p[1])*(r[0]-p[0]);if(Math.abs(area)<.005||area>0&&material.side!==THREE.DoubleSide)continue;
    a.fromBufferAttribute(positions,ia).applyMatrix4(object.matrixWorld);b.fromBufferAttribute(positions,ib).applyMatrix4(object.matrixWorld);c.fromBufferAttribute(positions,ic).applyMatrix4(object.matrixWorld);
    normal.subVectors(b,a).cross(edge.subVectors(c,a)).normalize();
    const key=Math.max(0,normal.dot(light)),rim=Math.max(0,-normal.x)*.10,shade=material.isMeshBasicMaterial?1:.24+key*.70+rim;
    const color=material.color.clone().multiplyScalar(shade).convertLinearToSRGB();
    const css=`rgb(${Math.round(Math.min(1,color.r)*255)},${Math.round(Math.min(1,color.g)*255)},${Math.round(Math.min(1,color.b)*255)})`;
    surfaces.push({p,q,r,z:(p[2]+q[2]+r[2])/3,css});rasterDepth(p,q,r,area);
   }
  });
  surfaces.sort((a,b)=>b.z-a.z);
  for(const t of surfaces){ctx.fillStyle=t.css;ctx.strokeStyle=t.css;ctx.lineWidth=.45;ctx.beginPath();ctx.moveTo(t.p[0],t.p[1]);ctx.lineTo(t.q[0],t.q[1]);ctx.lineTo(t.r[0],t.r[1]);ctx.closePath();ctx.fill();ctx.stroke();}
  let drawn=0;
  for(const object of details){
   const positions=object.geometry.attributes.position,material=object.material;matrix.multiplyMatrices(view,object.matrixWorld);const m=matrix.elements;
   if(object.isPoints){
    const color=object.geometry.attributes.color;let colors=cachedColors.get(object.geometry);
    if(!colors){colors=[];const c=new THREE.Color();for(let i=0;i<positions.count;i++){if(color)c.fromBufferAttribute(color,i);else c.copy(material.color||new THREE.Color('#94dfff'));c.convertLinearToSRGB();colors.push(`${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)}`);}cachedColors.set(object.geometry,colors);}
    const count=Math.min(positions.count,object.geometry.drawRange.count),projected=[];
    for(let i=0;i<count;i++){const p=project(positions.array,i*3,m);if(!valid(p)||Math.abs(p[0])>1.04||Math.abs(p[1])>1.04)continue;const s=screen(p);if(blocked(s))continue;projected.push([s[2],s[0],s[1],i]);}
    projected.sort((a,b)=>b[0]-a[0]);
    for(const [,x,y,i]of projected){const size=Math.max(.65,Math.min(1.25,height/750));ctx.fillStyle=`rgba(${colors[i]},${Math.min(.65,material.opacity??1)})`;ctx.fillRect(x,y,size,size);drawn++;}
   }else{
    const c=(material.color||new THREE.Color('#7bcaff')).clone().convertLinearToSRGB();ctx.strokeStyle=`rgba(${Math.round(c.r*255)},${Math.round(c.g*255)},${Math.round(c.b*255)},${Math.min(.62,material.opacity??.3)})`;ctx.lineWidth=.75;ctx.beginPath();
    const step=object.isLineSegments?2:1;for(let i=0;i<positions.count-1;i+=step){const p=project(positions.array,i*3,m),q=project(positions.array,(i+1)*3,m);if(!valid(p)||!valid(q))continue;const a=screen(p),b=screen(q);if(blocked([(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2]))continue;ctx.moveTo(a[0],a[1]);ctx.lineTo(b[0],b[1]);}ctx.stroke();
   }
  }
  return drawn;
 }
 return {resize,render,dispose(){if(disposed)return;disposed=true;depth=new Float32Array(0);ctx.clearRect(0,0,canvas.width,canvas.height);}};
}
