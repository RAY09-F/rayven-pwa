export const paperNames={baldr:'VOLSTAGG',vidar:'HEIMDALL',tyr:'FANDRAL',heimdall:'HOGUN',freya:'FRIGGA'};
export function paperPerformance(rows,period='all',now=Date.now()){
  const day=n=>new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(n));
  const valid=rows.filter(t=>typeof t.pnl==='number'&&Number.isFinite(t.pnl)&&Number.isFinite(Date.parse(t.exitTime)));
  const filtered=valid.filter(t=>{const at=Date.parse(t.exitTime);if(at>now)return false;return period==='today'?day(at)===day(now):period==='week'?at>=now-7*86400000:period==='month'?at>=now-30*86400000:true;});
  const wins=filtered.filter(t=>t.pnl>0),losses=filtered.filter(t=>t.pnl<0),flat=filtered.filter(t=>t.pnl===0);
  return {rows:filtered,wins:wins.length,losses:losses.length,flat:flat.length,rate:filtered.length?wins.length/filtered.length*100:null,profit:wins.reduce((a,t)=>a+t.pnl,0),loss:losses.reduce((a,t)=>a-t.pnl,0),net:filtered.reduce((a,t)=>a+t.pnl,0),excluded:rows.length-valid.length};
}
export function markedPositions(portfolio,marks){return Object.entries(portfolio?.positions||{}).map(([id,p])=>{const mark=marks[id];const valid=typeof p.entryPrice==='number'&&typeof p.qty==='number'&&Number.isFinite(p.entryPrice)&&Number.isFinite(p.qty)&&Number.isFinite(mark?.price);return {id,...p,unrealized:valid?(mark.price-p.entryPrice)*p.qty*(String(p.side).toLowerCase()==='short'?-1:1):null,markAt:mark?.at??null};});}
