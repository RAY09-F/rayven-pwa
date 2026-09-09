// Procedural holographic light field. Ambient animation is decorative, never fake telemetry.
export function createHolographicField(T,scene,persona){
 const root=new T.Group();root.name='floating-holographic-field';scene.add(root);
 const color=new T.Color({thor:0x55caff,loki:0xffd84d,odin:0xffbe60}[persona]);
 const geometries=[],materials=[],rings=[];
 const ownG=g=>(geometries.push(g),g),ownM=m=>(materials.push(m),m);
 for(let i=0;i<4;i++){
  const m=ownM(new T.MeshBasicMaterial({color,transparent:true,opacity:.35-i*.045,blending:T.AdditiveBlending,depthWrite:false}));
  const ring=new T.Mesh(ownG(new T.TorusGeometry(1.85+i*.15,.009+i*.003,5,96,Math.PI*1.65)),m);
  ring.rotation.x=Math.PI/2;ring.position.y=-.23-i*.09;root.add(ring);rings.push(ring);
 }
 // GPU motion: no position-buffer rebuild per frame, no independent animation loop.
 const count=480,positions=new Float32Array(count*3),seeds=new Float32Array(count);
 for(let i=0;i<count;i++){const seed=(Math.sin(i*127.1+71)*43758.5453)%1;seeds[i]=Math.abs(seed);positions[i*3]=Math.sin(i*2.39996)*(1.3+(i%19)*.2);positions[i*3+1]=(i%61)/61*7-1.8;positions[i*3+2]=-1.1-Math.abs(Math.cos(i))*2;}
 const geo=ownG(new T.BufferGeometry());geo.setAttribute('position',new T.BufferAttribute(positions,3));geo.setAttribute('seed',new T.BufferAttribute(seeds,1));
 const mat=ownM(new T.ShaderMaterial({transparent:true,depthWrite:false,blending:T.AdditiveBlending,uniforms:{clock:{value:0},tint:{value:color},strength:{value:.7}},vertexShader:`attribute float seed;uniform float clock;varying float vSeed;void main(){vSeed=seed;vec3 p=position;p.y=mod(p.y+1.8+clock*(.12+seed*.13),7.)-1.8;p.x+=sin(clock*.5+seed*30.)*.08;vec4 mv=modelViewMatrix*vec4(p,1.);gl_Position=projectionMatrix*mv;gl_PointSize=clamp((18.+seed*24.)/-mv.z,1.,5.);}`,fragmentShader:`uniform vec3 tint;uniform float strength;varying float vSeed;void main(){float d=length(gl_PointCoord-.5)*2.;float a=pow(max(0.,1.-d),2.);gl_FragColor=vec4(tint,a*strength*(.3+vSeed*.7));}`}));
 root.add(new T.Points(geo,mat));let disposed=false;
 return {update(time,animated,state){if(animated){mat.uniforms.clock.value=time;rings.forEach((r,i)=>r.rotation.z=time*(i%2?-.3:.24)+i);}mat.uniforms.strength.value=['thinking','speaking','listening'].includes(state)?1:.65;},dispose(){if(disposed)return;disposed=true;root.removeFromParent();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}
