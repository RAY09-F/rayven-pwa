// Operator-only CLI. Secrets stay in the user's profile, never arguments or output.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';
import {homedir} from 'node:os';
import {randomBytes} from 'node:crypto';
import {spawnSync} from 'node:child_process';
const file=homedir()+'/.asgard-phone-setup-token',command=process.argv[2];
if(command==='install-key'){
  if(!existsSync(file))writeFileSync(file,randomBytes(32).toString('hex'),{mode:0o600});
  const wrangler=process.env.ASGARD_WRANGLER_PATH;if(!wrangler)throw Error('ASGARD_WRANGLER_PATH required');
  const r=spawnSync(process.execPath,[wrangler,'secret','put','PHONE_SETUP_TOKEN'],{input:readFileSync(file,'utf8').trim()+'\n',encoding:'utf8'});
  console.log(r.stdout);if(r.status){console.error(r.stderr);process.exit(r.status);}process.exit(0);
}
const token=readFileSync(file,'utf8').trim(),base='https://asgrard-backend.rayanfahil2.workers.dev';
const path={provider:'provider',status:'status',configure:'configure',pair:'pair-link',test:'test'}[command];
if(!path)throw Error('Use provider, status, configure, pair or test');
const body=command==='configure'?JSON.parse(readFileSync(process.argv[3],'utf8')):command==='test'?{persona:process.argv[3]||'thor'}:command==='pair'?{}:undefined;
const r=await fetch(base+'/phone-api/'+path,{method:body===undefined?'GET':'POST',headers:{'Content-Type':'application/json','X-Asgard-Phone-Setup':token,...(process.env.ASGARD_QA_VERSION?{'Cloudflare-Workers-Version-Overrides':`asgrard-backend="${process.env.ASGARD_QA_VERSION}"`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
const data=await r.json();console.log(JSON.stringify({http:r.status,...data},null,2));if(!r.ok)process.exit(1);
