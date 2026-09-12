import {TOOLS} from '../src/tools/catalog-lab.js';
const tool=TOOLS.find(t=>t.name==='crypto_orderbook_snapshot');
for(const symbol of ['BTC','ETH','DOGE','SHIB']){
 const r=JSON.parse(await tool.run({}, {symbol}));
 if(!Number.isFinite(r.spreadBps))throw Error(`${symbol}: ${r.error||'missing spread'}`);
 console.log(JSON.stringify({symbol,spreadBps:r.spreadBps,levels:r.levels}));
}
