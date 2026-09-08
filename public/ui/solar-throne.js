import {createCouncilScene} from './council-scene.js';
import {buildSolarThrone,SOLAR_AGENT_IDS} from './solar-throne-model.js';

export function createSolarThrone(host,options) {
 return createCouncilScene(host,{
  id:'solar-throne',persona:'odin',build:buildSolarThrone,agentIds:SOLAR_AGENT_IDS,
  description:'Solar Throne: drag to orbit, select an eye to open its advisor',
  caption:'Drag to orbit · click an eye to inspect',
  coreLabel:{name:'ODIN',role:'ALL FATHER · THE SOURCE · PAPER / SIM',css:'#ffd27a'},
  coreOffset:1.45,agentOffset:-.55,pixelRatio:1.25,exposure:1.05,fogColor:0x07070a,fogDensity:.035,
  hemisphere:[0xa8b4c8,0x14100c,.55],keyIntensity:1.76,fillIntensity:.4,
  studioColor:0x0a0908,environmentIntensity:.6,groundOpacity:.5,shadowExtent:6.5,
  fitRadius:4.6,viewTarget:[0,1.5,0],viewDirection:[.35,.45,1],autoRotateSpeed:.6,
  frameStride:3,flash:true,plate:true,
  // Warm key, warm bounce, a low floor kick, a dim ceiling and a rim panel behind the disc.
  panels:[[0xfff1dc,7,[4,6,3],5,3],[0xffd9a0,3,[-6,3,-4],6,4],[0xffe0b0,2.5,[0,-3,6],8,2],[0x5a4a30,1.2,[0,8,0],12,12],[0xffc060,4,[0,2,-6],3,5]]
 },options);
}
