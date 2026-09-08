import {readTool,field} from './api-tool.js';
const str=field;
export const TOOLS=[
 readTool({name:'web_firecrawl_search',description:'Search public pages through Firecrawl. Disabled until the key and monthly free credits are verified.',properties:{query:str('Search query')},required:['query'],example:{query:'Bakersfield public library'},key:'FIRECRAWL_API_KEY',enable:'FIRECRAWL_ENABLED',request:(env,input)=>({url:'https://api.firecrawl.dev/v2/search',method:'POST',headers:{Authorization:`Bearer ${env.FIRECRAWL_API_KEY}`,'content-type':'application/json'},body:JSON.stringify({query:input.query,limit:5})}),select:value=>value.data}),
 readTool({name:'web_exa_search',description:'Find public pages with Exa neural search. Requires key and verified free-credit budget.',properties:{query:str('Search query')},required:['query'],example:{query:'research on river restoration'},key:'EXA_API_KEY',enable:'EXA_ENABLED',request:(env,input)=>({url:'https://api.exa.ai/search',method:'POST',headers:{'x-api-key':env.EXA_API_KEY,'content-type':'application/json'},body:JSON.stringify({query:input.query,numResults:5})}),select:value=>value.results})
];
