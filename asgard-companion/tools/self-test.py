"""Measured acceptance checks; save honest PASS/FAIL results without credentials."""
import asyncio,json,sys,time,subprocess,os
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from config import Config,ROOT
import psutil,requests,websockets
results=[]
def check(name,ok,detail=''):
    row={'check':name,'pass':bool(ok),'detail':detail};results.append(row);print(('PASS' if ok else 'FAIL')+' '+name+' '+str(detail),flush=True)
async def control(c,op):
    async with websockets.connect(f"ws://127.0.0.1:{c['port']}") as ws:
        await ws.send(json.dumps({'token':c.secrets['local_token']}));await ws.recv()
        await ws.send(json.dumps({'op':op,'id':'self-test'}))
        while True:
            data=json.loads(await asyncio.wait_for(ws.recv(),10))
            if data.get('id')=='self-test':return data
async def main():
    c=Config();pid=int((ROOT/'asgard.pid').read_text());p=psutil.Process(pid)
    check('Companion running below-normal',p.is_running() and p.nice()==psutil.BELOW_NORMAL_PRIORITY_CLASS)
    status=await control(c,'status');check('Authenticated WebSocket status',status['ok'])
    info=status.get('result',{});check('OBS replay active',info.get('obs',{}).get('replay') and info.get('obs',{}).get('profile')=='Asgard',str(info.get('obs')))
    check('Tray icon visible',info.get('tray_visible',False))
    check('Display capture has real dimensions',info.get('obs',{}).get('capture_width',0)>0 and info.get('obs',{}).get('capture_height',0)>0)
    try:
        async with websockets.connect(f"ws://127.0.0.1:{c['port']}") as ws:
            await ws.send('{"token":"wrong"}');await ws.recv()
        check('Wrong token refused',False)
    except websockets.ConnectionClosed as e:check('Wrong token refused',e.code==4401)
    started=time.monotonic();clip=await control(c,'clip');elapsed=time.monotonic()-started;path=clip.get('result',{}).get('path')
    check('Confirmed replay saved within 2s',clip.get('ok') and path and Path(path).is_file() and elapsed<2,f'{elapsed:.3f}s; {path}')
    s=requests.Session();s.headers['Authorization']='Bearer '+c.secrets['local_token']
    r=s.get(c['worker']+'/health',timeout=10);check('Worker health',r.ok and r.json().get('companionVersion')==1)
    for god in ('thor','loki','odin'):
        r=s.post(c['worker']+'/say',json={'assistant':god,'text':'Here.','format':'pcm'},timeout=15)
        check('Voice bytes '+god,r.ok and r.headers.get('content-type','').startswith('audio/') and len(r.content)>100, f'HTTP {r.status_code}; {len(r.content)} bytes (not played)')
    r=subprocess.run([sys.executable,'-m','pytest',str(ROOT/'tests'),'-q'],capture_output=True,text=True);check('Fast-path tests',r.returncode==0,r.stdout.strip())
    startup=Path(os.environ['APPDATA'])/'Microsoft/Windows/Start Menu/Programs/Startup'
    check('Login shortcuts',all((startup/n).exists() for n in ('Asgard Voice.lnk','Asgard Replay.lnk')))
    r=subprocess.run(['schtasks','/Query','/TN','AsgardVoiceWatchdog'],capture_output=True);check('Watchdog registered',r.returncode==0)
    print('Measuring idle resource use for 60 seconds...',flush=True);p.cpu_percent()
    await asyncio.sleep(60)
    cpu=p.cpu_percent();ram=p.memory_info().rss/1048576
    check('Idle CPU <=5% of one core',cpu<=5,f'{cpu:.2f}%')
    check('Idle RAM <=150MB',ram<=150,f'{ram:.1f} MB')
    p.terminate();started=time.monotonic()
    subprocess.run(['schtasks','/Run','/TN','AsgardVoiceWatchdog'],capture_output=True)
    recovered=False
    for _ in range(30):
        await asyncio.sleep(1)
        try:
            fresh=int((ROOT/'asgard.pid').read_text())
            if fresh!=pid and psutil.pid_exists(fresh):
                live=await control(c,'status');recovered=live.get('ok',False)
                if recovered:break
        except Exception:continue
    check('Watchdog restarts killed companion',recovered,f'{time.monotonic()-started:.2f}s')
    (ROOT.parent/'logs/acceptance.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
    return all(r['pass'] for r in results)
if __name__=='__main__':
    try:passed=asyncio.run(main())
    except Exception as e:check('Self-test completed',False,type(e).__name__+': '+str(e));passed=False;(ROOT.parent/'logs/acceptance.json').write_text(json.dumps(results,indent=2))
    raise SystemExit(0 if passed else 1)
