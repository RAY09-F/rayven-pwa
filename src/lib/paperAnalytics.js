// Descriptive paper results only. No forecasts or real-money recommendations.
export function summarizePaperTrades(trades) {
  const valid = trades.filter(t => Number.isFinite(t.pnl));
  const wins = valid.filter(t => t.pnl > 0), losses = valid.filter(t => t.pnl < 0);
  const grossProfit = wins.reduce((s,t)=>s+t.pnl,0);
  const grossLoss = -losses.reduce((s,t)=>s+t.pnl,0);
  const n = valid.length, p = n ? wins.length/n : 0, z = 1.96;
  const center = n ? (p+z*z/(2*n))/(1+z*z/n) : 0;
  const radius = n ? z*Math.sqrt(p*(1-p)/n+z*z/(4*n*n))/(1+z*z/n) : 0;
  return {trades:n,wins:wins.length,losses:losses.length,breakeven:n-wins.length-losses.length,
    pnl:grossProfit-grossLoss,winRatePct:n?p*100:null,
    winRateInterval95:n?[Math.max(0,center-radius)*100,Math.min(1,center+radius)*100]:null,
    profitFactor:grossLoss?grossProfit/grossLoss:null,
    averageNetPerTrade:n?(grossProfit-grossLoss)/n:null,
    sampleStatus:n<100?'preliminary':'historical sample; not a forecast'};
}

export function paperSegments(trades, agents, instruments, now=Date.now()) {
  const category=t=>t.category || instruments[agents[t.agent]?.instrumentId]?.category ||
    (instruments[agents[t.agent]?.instrumentId]?.provider==='kraken'?'crypto':agents[t.agent]?'stocks':'unknown');
  const automatic = trades.filter(t=>!t.manual && !/MANUAL TEST/i.test(t.entryReason||''));
  const groups={regular:automatic.filter(t=>['stocks','crypto'].includes(category(t))),
    stocks:automatic.filter(t=>category(t)==='stocks'),crypto:automatic.filter(t=>category(t)==='crypto'),
    memes:automatic.filter(t=>category(t)==='memes')};
  return {label:'PAPER / SIMULATED',window:'retained closed-trade history (maximum 1000 records)',
    capital:'Shared simulated portfolio; separate performance categories, not separate funded accounts.',
    manualTradesExcluded:trades.length-automatic.length,
    groups:Object.fromEntries(Object.entries(groups).map(([name,list])=>[name,{
      ...summarizePaperTrades(list),last3Hours:summarizePaperTrades(list.filter(t=>Date.parse(t.exitTime)>=now-3*3600000))
    }]))};
}

// Return only valid, closed candles. Bad data blocks a decision instead of
// silently deleting a bar and creating a false continuous price history.
export function closedPaperCandles(raw, minutes, now=Date.now()) {
  if (!Array.isArray(raw) || !Number.isFinite(minutes) || minutes<=0) return [];
  if (raw.some(c=>!['time','open','high','low','close','volume'].every(k=>Number.isFinite(c[k])) || c.open<=0 || c.close<=0 || c.low<=0 || c.high<Math.max(c.open,c.close,c.low) || c.low>Math.min(c.open,c.close) || c.volume<0)) return [];
  return raw.filter(c=>c.time+minutes*60000<=now);
}
