const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

// Rectangles use center coordinates. Search above and beside earlier labels so
// resolving a collision never pushes a nameplate down onto its own gem.
export function placeNameplate(desired,placed,width,height){
 const {w,h}=desired,minX=w/2+3,maxX=Math.max(minX,width-w/2-3),minY=h/2+4,maxY=Math.max(minY,height-h/2-5);
 const x=clamp(desired.x,minX,maxX),y=clamp(desired.y,minY,maxY);
 const xs=[x,minX,maxX],ys=[y,minY];
 for(const r of placed){
  xs.push(clamp(r.x-(r.w+w)/2-4,minX,maxX),clamp(r.x+(r.w+w)/2+4,minX,maxX));
  const above=r.y-(r.h+h)/2-3;
  if(above<=y)ys.push(clamp(above,minY,y));
 }
 let best={x,y,w,h},bestOverlap=Infinity,bestDistance=Infinity;
 for(const cy of ys)for(const cx of xs){
  let overlap=0;
  for(const r of placed){
   const dx=Math.max(0,(w+r.w)/2+4-Math.abs(cx-r.x));
   const dy=Math.max(0,(h+r.h)/2+3-Math.abs(cy-r.y));
   if(dx>1e-7&&dy>1e-7)overlap+=dx*dy;
  }
  const distance=(cx-x)**2+(cy-y)**2;
  // If no collision-free placement exists, preserve bounds and minimize overlap.
  if(overlap<bestOverlap||(overlap===bestOverlap&&distance<bestDistance)){
   best={x:cx,y:cy,w,h};bestOverlap=overlap;bestDistance=distance;
  }
 }
 return best;
}
