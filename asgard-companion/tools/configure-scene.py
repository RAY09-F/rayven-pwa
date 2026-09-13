"""Finish Asgard's scene using OBS's authenticated public API."""
from pathlib import Path
import sys,json
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from config import Config
import obsws_python as ws
import os,time
c=Config();r=ws.ReqClient(host='127.0.0.1',port=4455,password=c.secrets['obs_password'],timeout=5)
if r.get_scene_collection_list().current_scene_collection_name!='Asgard':raise RuntimeError('Wrong scene collection; refusing edits')
names={i['inputName'] for i in r.get_input_list().inputs}
if 'Asgard Display' not in names:r.create_input('Asgard','Asgard Display','monitor_capture',{'monitor':0,'capture_cursor':True,'method':1},True)
displays=r.get_input_properties_list_property_items('Asgard Display','monitor_id').property_items
available=[d for d in displays if d['itemEnabled'] and d['itemValue']!='DUMMY']
if not available:raise RuntimeError('No real monitor is available for capture')
display=next((d for d in available if 'Primary Monitor' in d['itemName']),available[0])
r.set_input_settings('Asgard Display',{'monitor_id':display['itemValue'],'capture_cursor':True,'method':1},True)
# Persist the same verified monitor identifier for the next OBS launch.
scene_file=Path(os.environ['APPDATA'])/'obs-studio/basic/scenes/Asgard.json'
scene_json=json.loads(scene_file.read_text(encoding='utf-8-sig'))
for source in scene_json.get('sources',[]):
    if source.get('name')=='Asgard Display':source.setdefault('settings',{})['monitor_id']=display['itemValue']
scene_file.write_text(json.dumps(scene_json,indent=2),encoding='utf-8')
if 'Asgard Desktop Audio' not in names:r.create_input('Asgard','Asgard Desktop Audio','wasapi_output_capture',{'device_id':'default'},True)
for i in r.get_input_list().inputs:
    if i['inputKind']=='wasapi_input_capture':r.set_input_mute(i['inputName'],True)
r.set_current_program_scene('Asgard')
if r.get_replay_buffer_status().output_active:r.stop_replay_buffer()
for _ in range(30):
    if not r.get_replay_buffer_status().output_active:break
    time.sleep(.1)
else:raise RuntimeError('Replay buffer did not stop for configuration')
profile=Path(os.environ['APPDATA'])/'obs-studio/basic/profiles/Asgard'
(profile/'recordEncoder.json').write_text(json.dumps({'rate_control':'CQP','cqp':23,'keyint_sec':2,'preset':'p3','tune':'ll','multipass':'disabled','profile':'high','lookahead':False,'adaptive_quantization':False,'bf':2}),encoding='utf-8')
for key,value in {'RecType':'Standard','RecFilePath':c['clips'],'RecFormat2':'mkv','RecEncoder':'obs_nvenc_h264_tex','RecTracks':'1','RecRB':'true','RecRBTime':str(c['clip_seconds']),'RecRBSize':'512','RecRescale':'false'}.items():r.set_profile_parameter('AdvOut',key,value)
r.set_profile_parameter('Output','Mode','Advanced')
if not r.get_replay_buffer_status().output_active:r.start_replay_buffer()
for _ in range(30):
    if r.get_replay_buffer_status().output_active:break
    time.sleep(.1)
else:raise RuntimeError('Replay buffer failed to start')
print('OBS Asgard display capture, desktop audio and replay buffer ready. Microphone recording disabled.')
