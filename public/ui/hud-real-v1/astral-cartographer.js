import {createCouncilScene} from './council-scene.js';
import {buildAstralCartographer,ASTRAL_AGENT_IDS} from './astral-cartographer-model.js';

export function createAstralCartographer(host,options) {
 return createCouncilScene(host,{
  id:'astral-cartographer',persona:'thor',build:buildAstralCartographer,agentIds:ASTRAL_AGENT_IDS,
  description:'Astral Cartographer: drag to orbit, select a storm bolt to open its advisor',
  caption:'Drag to orbit · click a storm bolt to inspect',
  coreLabel:{name:'THOR',role:'PRINCE OF ASGARD · THE NORTH VOICE',css:'#7fb8ff'},
  coreOffset:1.3,pixelRatio:1.25,exposure:1.35,fogColor:0x040914,fogDensity:.04,
  hemisphere:[0x6a9ae0,0x0a1630,.55],keyIntensity:1.3,fillIntensity:.3,
  studioColor:0x050c1a,frameStride:3,flash:true,
  panels:[[0xdfe9ff,6,[4,6,3],5,3],[0x6aa8ff,3.5,[-6,3,-4],6,4],[0xffe9c8,1.5,[0,-3,6],8,2],[0x1a4a9a,1.2,[0,8,0],12,12]]
 },options);
}
