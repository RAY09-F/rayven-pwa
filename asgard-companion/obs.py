"""OBS replay control; report success only after the saved-file event."""
import logging
import subprocess
import threading
import time
from pathlib import Path
import obsws_python as ws
class OBS:
    def __init__(self,config):
        self.config=config;self.req=None;self.events=None;self.saved=threading.Event();self.path=None;self.lock=threading.RLock()
    def connect(self):
        self.close()
        args=dict(host='127.0.0.1',port=4455,password=self.config.secrets['obs_password'],timeout=3)
        self.req=ws.ReqClient(**args);self.events=ws.EventClient(**args)
        self.events.callback.register(self.on_replay_buffer_saved)
        profile=self.req.get_profile_list().current_profile_name
        if profile!='Asgard':
            if self.req.get_record_status().output_active or self.req.get_stream_status().output_active:raise RuntimeError('OBS is recording or streaming; cannot switch profile')
            if self.req.get_replay_buffer_status().output_active:self.req.stop_replay_buffer()
            self.req.set_current_profile('Asgard')
        if self.req.get_scene_collection_list().current_scene_collection_name!='Asgard':self.req.set_current_scene_collection('Asgard')
        displays=self.req.get_input_properties_list_property_items('Asgard Display','monitor_id').property_items
        available=[d for d in displays if d['itemEnabled'] and d['itemValue']!='DUMMY']
        if not available:raise RuntimeError('No display is available')
        chosen=next((d for d in available if 'Primary Monitor' in d['itemName']),available[0])
        self.req.set_input_settings('Asgard Display',{'monitor_id':chosen['itemValue']},True)
        self.ensure_replay_buffer()
    def close(self):
        for client in (self.req,self.events):
            if client:
                try:client.disconnect()
                except Exception:logging.warning('OBS connection close failed')
        self.req=None;self.events=None
    def on_replay_buffer_saved(self,data):
        self.path=data.saved_replay_path;self.saved.set()
    def start(self):
        import psutil
        if not any(p.info['name'].lower()=='obs64.exe' for p in psutil.process_iter(['name']) if p.info['name']):
            exe=Path(self.config['obs_exe'])
            subprocess.Popen([str(exe),'--profile','Asgard','--collection','Asgard','--startreplaybuffer','--minimize-to-tray','--disable-updater'],cwd=exe.parent,creationflags=subprocess.CREATE_NO_WINDOW)
        for _ in range(20):
            try:self.connect();return
            except Exception:time.sleep(.5)
        raise RuntimeError('OBS could not start its replay buffer')
    def ensure_replay_buffer(self):
        if not self.req.get_replay_buffer_status().output_active:self.req.start_replay_buffer()
    def clip(self):
        with self.lock:
            try:
                if not self.req:self.connect()
                self.ensure_replay_buffer()
            except Exception:
                self.start();return {'ok':False,'started':True,'say':'OBS was off. It is on now. Say it again.'}
            self.saved.clear();self.path=None;self.req.save_replay_buffer()
            if not self.saved.wait(2):raise TimeoutError('OBS has not confirmed saving the replay')
            path=Path(self.path).resolve()
            if not path.is_relative_to(Path(self.config['clips']).resolve()) or not path.is_file():raise RuntimeError('OBS returned an invalid clip path')
            return {'ok':True,'path':str(path),'say':'Clipped.'}
    def status(self):
        with self.lock:
            try:
                if not self.req:self.connect()
                item=self.req.get_scene_item_id('Asgard','Asgard Display').scene_item_id
                transform=self.req.get_scene_item_transform('Asgard',item).scene_item_transform
                return {'running':True,'replay':self.req.get_replay_buffer_status().output_active,'profile':self.req.get_profile_list().current_profile_name,'capture_width':transform.get('sourceWidth'),'capture_height':transform.get('sourceHeight')}
            except Exception:return {'running':False,'replay':False,'profile':None}
    def set_seconds(self,seconds):
        with self.lock:
            if not self.req:self.connect()
            self.req.stop_replay_buffer()
            for _ in range(30):
                if not self.req.get_replay_buffer_status().output_active:break
                time.sleep(.1)
            else:raise TimeoutError('Replay buffer did not stop')
            self.req.set_profile_parameter('SimpleOutput','RecRBTime',str(seconds))
            self.req.set_profile_parameter('AdvOut','RecRBTime',str(seconds))
            self.req.start_replay_buffer()
