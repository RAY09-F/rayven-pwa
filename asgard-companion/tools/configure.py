"""Configure only Asgard's local installation and OBS profile; preserve backups."""
from pathlib import Path
import configparser,json,os,secrets,shutil,sys,time
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from config import ROOT,DEFAULTS
def write(path,text):
    path.parent.mkdir(parents=True,exist_ok=True)
    if path.exists() and path.read_text(encoding='utf-8-sig')!=text:
        backup=ROOT.parent/'backups'/str(int(time.time()))/path.name
        backup.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(path,backup)
    path.write_text(text,encoding='utf-8')
if not (ROOT/'secrets.json').exists():
    write(ROOT/'secrets.json',json.dumps({'obs_password':secrets.token_urlsafe(18),'local_token':secrets.token_urlsafe(32)},indent=2))
credentials=json.loads((ROOT/'secrets.json').read_text())
if not (ROOT/'config.json').exists():write(ROOT/'config.json',json.dumps(DEFAULTS,indent=2))
settings=DEFAULTS|json.loads((ROOT/'config.json').read_text())
obs=Path(os.environ['APPDATA'])/'obs-studio'
profile=obs/'basic/profiles/Asgard/basic.ini'
if not profile.exists():
    write(profile,f'''[General]
Name=Asgard

[Output]
Mode=Advanced
FilenameFormatting=%CCYY-%MM-%DD %hh-%mm-%ss

[SimpleOutput]
FilePath=C:/Asgard/Clips
RecFormat2=mkv
RecQuality=Small
RecEncoder=nvenc
RecRB=true
RecRBTime={settings['clip_seconds']}
RecRBSize=512
RecRBPrefix=Replay
NVENCPreset2=p3
ABitrate=160

[Video]
BaseCX=1920
BaseCY=1080
OutputCX=1920
OutputCY=1080
FPSType=0
FPSCommon=60
ScaleType=bilinear

[Audio]
SampleRate=48000
ChannelSetup=Stereo

[AdvOut]
RecType=Standard
RecFilePath=C:/Asgard/Clips
RecFormat2=mkv
RecEncoder=obs_nvenc_h264_tex
RecTracks=1
RecRescale=false
RecRB=true
RecRBTime={settings['clip_seconds']}
RecRBSize=512
''')
scene=obs/'basic/scenes/Asgard.json'
encoder=profile.parent/'recordEncoder.json'
if not encoder.exists():write(encoder,json.dumps({'rate_control':'CQP','cqp':23,'keyint_sec':2,'preset':'p3','tune':'ll','multipass':'disabled','profile':'high','lookahead':False,'adaptive_quantization':False,'bf':2}))
if not scene.exists():write(scene,json.dumps({'name':'Asgard','current_scene':'Asgard','current_program_scene':'Asgard','scene_order':[{'name':'Asgard'}],'sources':[{'name':'Asgard','id':'scene','settings':{'items':[]}}]},indent=2))
websocket=obs/'plugin_config/obs-websocket/config.json'
existing=json.loads(websocket.read_text()) if websocket.exists() else {}
existing.update(first_load=False,server_enabled=True,server_port=4455,auth_required=True,server_password=credentials['obs_password'],alerts_enabled=False)
write(websocket,json.dumps(existing,indent=2))
for name in ('global.ini','user.ini'):
    p=obs/name
    if not p.exists():write(p,'[General]\nFirstRun=false\nEnableAutoUpdates=false\n\n[Basic]\nProfile=Asgard\nProfileDir=Asgard\nSceneCollection=Asgard\nSceneCollectionFile=Asgard\n\n[BasicWindow]\nPreviewEnabled=false\nSysTrayEnabled=true\nSysTrayWhenStarted=true\n')
print('Local credentials and Asgard OBS profile configured; no credentials printed.')
