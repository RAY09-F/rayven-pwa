// Pure bounds shared by pointer and accessible position controls. No backend state.
export const COUNCIL_POSITIONS=[[0,0,-4.35],[4,0,-.4],[3.4,0,3.3],[-3.4,0,3.3],[-4,0,-.4]];
const finite=(v,fallback=0)=>typeof v==='number'&&Number.isFinite(v)?v:fallback;
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
export function clampLayout(value={}){return {x:clamp(finite(value?.x),-.45,.45),y:clamp(finite(value?.y),0,.35),z:clamp(finite(value?.z),-.35,.35)};}
export function clampView(value={}){return {yaw:clamp(finite(value?.yaw),-.42,.42),elevation:clamp(finite(value?.elevation,.68),.42,.78),zoom:clamp(finite(value?.zoom,1),.82,1.20)};}
export function normalizedSceneState(value){return ['idle','connecting','permission-pending','listening','thinking','speaking','error','cancelled'].includes(value)?value:'idle';}
