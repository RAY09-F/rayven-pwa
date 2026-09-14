// Three total attempts. Never replay writes or an ambiguous external action.
export async function retryRead(operation, {method='GET', sleep=ms=>new Promise(r=>setTimeout(r,ms))}={}) {
  const safe=['GET','HEAD'].includes(method.toUpperCase());
  for(let attempt=0;;attempt++) {
    const result=await operation();
    const transient=result.retryable===true || [408,429,500,502,503,504].includes(result.status);
    if(!safe || !transient || attempt===2)return result;
    const delay=Math.max([1000,4000][attempt],result.retryAfterMs||0);
    // Do not ignore a provider's long cooldown or tie up the caller indefinitely.
    if(delay>16000)return result;
    await sleep(delay);
  }
}
