// One application / process / swap chain per sample. All durations in ms.
export function frameSummary(samples){
 if(!Array.isArray(samples)||samples.length<2||samples.length>500000)throw Error('Supply 2–500,000 frame durations in milliseconds.');
 if(samples.some(n=>typeof n!=='number'||!Number.isFinite(n)||n<=0||n>60000))throw Error('Frame durations must be finite, positive and no more than 60,000 ms.');
 const sorted=[...samples].sort((a,b)=>a-b),mean=samples.reduce((s,n)=>s+n,0)/samples.length,q=p=>sorted[Math.ceil(p*sorted.length)-1];
 const slow=sorted.slice(-Math.max(1,Math.ceil(sorted.length*.01))),slowMean=slow.reduce((s,n)=>s+n,0)/slow.length;
 return {frames:samples.length,durationSeconds:mean*samples.length/1000,meanFrameMs:mean,averageFps:1000/mean,p95FrameMs:q(.95),p99FrameMs:q(.99),slowestOnePercentFps:1000/slowMean,over16_67MsPct:100*samples.filter(n=>n>1000/60).length/samples.length,
  definition:'Average FPS = 1000 / mean frame duration. Slowest 1% FPS = 1000 / mean of the slowest ceil(N × .01) frame durations. Nearest-rank percentiles. Not input latency.',limitation:'Supplied capture only. Compare the same application, swap chain, scene, resolution and settings. Small captures are noisy; this is not a live sensor.'};
}
export function frameGroups(rows,column){
 const allowed=['CPUFrameTime','MsBetweenPresents','FrameTime'];if(!allowed.includes(column))throw Error('Select a supported frame-duration column.');
 const groups=new Map();let excluded=0;
 for(const row of rows){const raw=row[column],n=Number(raw);if(raw==null||String(raw).trim()===''||!Number.isFinite(n)||n<=0||n>60000){excluded++;continue;}
  const key=JSON.stringify([row.Application||'Application not recorded',row.ProcessID||'PID not recorded',row.SwapChainAddress||'Swap chain not recorded']);
  if(!groups.has(key))groups.set(key,[]);groups.get(key).push(n);
 }
 return {groups:[...groups].map(([key,samples])=>({key,label:JSON.parse(key).join(' · '),samples})),excluded};
}
