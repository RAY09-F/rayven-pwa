"""Local settings and atomic writes; credentials never enter logs."""
from pathlib import Path
import json
import threading
ROOT = Path(__file__).resolve().parent
DEFAULTS = dict(worker='https://asgrard-backend.rayanfahil2.workers.dev', fallback='https://rayven-backend.rayanfahil2.workers.dev', port=47321, sensitivity=0.5, command_window=6, max_command=8, silence_ms=700, clip_seconds=30, muted=False, noise_floor=120, calibrated_at=0, obs_exe=r'C:\Program Files\obs-studio\bin\64bit\obs64.exe', clips=r'C:\Asgard\Clips', local_model='small')
class Config:
    def __init__(self):
        self.lock = threading.RLock()
        self.data = DEFAULTS | self.read('config.json')
        self.secrets = self.read('secrets.json')
    def read(self, name):
        p = ROOT / name
        return json.loads(p.read_text(encoding='utf-8-sig')) if p.exists() else {}
    def validate(self, changes):
        bounds = dict(sensitivity=(0.1,0.9), command_window=(2,6), clip_seconds=(15,120))
        for key, value in changes.items():
            if key not in bounds and key not in ('muted','noise_floor','calibrated_at','port'): raise ValueError('Unsupported setting')
            if key in bounds and (not isinstance(value,(float,int)) or not bounds[key][0] <= value <= bounds[key][1]): raise ValueError('Setting outside limits')
            if key == 'muted' and not isinstance(value,bool): raise ValueError('Mute must be boolean')
    def save(self, changes):
        self.validate(changes)
        with self.lock:
            self.data.update(changes)
            temp = ROOT / 'config.tmp'
            temp.write_text(json.dumps(self.data,indent=2),encoding='utf-8')
            temp.replace(ROOT/'config.json')
    def __getitem__(self,key): return self.data[key]
