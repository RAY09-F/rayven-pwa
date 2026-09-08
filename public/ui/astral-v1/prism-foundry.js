import {createCouncilScene} from './council-scene.js';
import {buildPrismFoundry,PRISM_AGENT_IDS} from './prism-foundry-model.js';

export function createPrismFoundry(host,options) {
 return createCouncilScene(host,{
  id:'prism-foundry',persona:'loki',build:buildPrismFoundry,agentIds:PRISM_AGENT_IDS,
  description:'Prism Foundry: drag to orbit, select a crystal to open its advisor',
  caption:'Drag to orbit · click a crystal to inspect',
  coreLabel:{name:'LOKI',role:'GOD OF MISCHIEF · THE ONE WHO MAKES',css:'#ffd84a'},
  panels:[[0xffe6c0,6,[4,6,3],5,3],[0x9ad4ff,3,[-6,3,-4],6,4],[0xfff0d0,1.5,[0,-3,6],8,2],[0x2a6a9a,1,[0,8,0],12,12]]
 },options);
}
