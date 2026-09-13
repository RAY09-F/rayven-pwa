"""Explicit local action allow-list; app discovery never accepts arbitrary commands."""
import ctypes
import difflib
import json
import logging
import os
import re
import subprocess
import time
from pathlib import Path
from fastpath import Action,normalise
def discover_apps():
    apps={}
    for base in (Path(os.environ['APPDATA'])/'Microsoft/Windows/Start Menu/Programs',Path(os.environ['PROGRAMDATA'])/'Microsoft/Windows/Start Menu/Programs'):
        for p in base.rglob('*.lnk'):
            name=normalise(p.stem)
            if any(x in name for x in ('uninstall','powershell','command prompt','terminal','registry','shutdown')):continue
            apps.setdefault(name,{'shortcut':str(p)})
    try:
        import winreg
        with winreg.OpenKey(winreg.HKEY_CURRENT_USER,r'Software\Valve\Steam') as key:steam=Path(winreg.QueryValueEx(key,'SteamPath')[0])
        folders=[steam];vdf=steam/'steamapps/libraryfolders.vdf'
        if vdf.exists():folders += [Path(p.replace('\\\\','\\')) for p in re.findall(r'"path"\s+"([^"]+)"',vdf.read_text(encoding='utf-8'))]
        for folder in folders:
            for manifest in (folder/'steamapps').glob('appmanifest_*.acf'):
                text=manifest.read_text(encoding='utf-8');name=re.search(r'"name"\s+"([^"]+)"',text);appid=re.search(r'"appid"\s+"(\d+)"',text)
                if name and appid:apps[normalise(name[1])]={'steam':appid[1]}
    except FileNotFoundError:pass
    except Exception as e:logging.warning('Steam discovery: %s',type(e).__name__)
    return apps
class Actions:
    def __init__(self,app):self.app=app;self.apps=discover_apps();self.pending=None
    def run(self,action:Action,god):
        op=action.op
        if op=='clip':
            result=self.app.obs.clip();self.app.health('obs',None);return result
        if op=='mute':self.app.mute(True);self.app.speaker.chime(god);return {'say':''}
        if op=='unmute':self.app.mute(False);return {'say':'Listening.'}
        if op=='stop':self.app.speaker.stop();return {'say':''}
        if op=='status':return {'say':'Here, sir.' if god=='thor' else 'Here.'}
        if op=='repeat':self.app.speaker.repeat();return {'say':''}
        if op=='time':return {'say':time.strftime("It's %#I:%M %p")+(', sir.' if god=='thor' else '.')}
        if op=='delete_last_clip':
            files=[p for p in Path(self.app.config['clips']).glob('*.mkv') if p.is_file()]
            if not files:return {'say':'There are no clips to delete.'}
            path=max(files,key=lambda p:p.stat().st_mtime).resolve();self.pending=(path,time.monotonic()+8,god)
            return {'say':f'Delete {path.name}? Say confirm.','needsConfirm':True}
        if op in ('confirm','cancel'):
            pending=self.pending;self.pending=None
            if not pending:return {'say':'Nothing is waiting for confirmation.'}
            path,expiry,owner=pending
            if op=='cancel' or time.monotonic()>expiry or owner!=god:return {'say':'Cancelled.'}
            if not path.is_relative_to(Path(self.app.config['clips']).resolve()):raise ValueError('Clip path outside clips folder')
            path.unlink();return {'say':'Done.'}
        if op=='open':
            name=normalise(str(action.value));target=self.apps.get(name)
            if not target:
                options=difflib.get_close_matches(name,self.apps,n=2,cutoff=.86)
                if len(options)==1:target=self.apps[options[0]]
            if not target:return {'say':'Which app?'}
            os.startfile(target['shortcut'] if 'shortcut' in target else 'steam://rungameid/'+target['steam'])
            return {'say':'Done.'}
        if op in ('volume','pc_mute','pc_unmute','volume_up','volume_down'):
            import comtypes
            from pycaw.pycaw import AudioUtilities
            comtypes.CoInitialize();volume=AudioUtilities.GetSpeakers().EndpointVolume
            if op in ('pc_mute','pc_unmute'):volume.SetMute(op=='pc_mute',None)
            else:
                level=float(action.value)/100 if op=='volume' else volume.GetMasterVolumeLevelScalar()+(.08 if op=='volume_up' else -.08)
                volume.SetMasterVolumeLevelScalar(max(0,min(1,level)),None)
            return {'say':'Done.'}
        keys={'play_pause':0xB3,'next':0xB0,'previous':0xB1}
        if op in keys:
            ctypes.windll.user32.keybd_event(keys[op],0,0,0);ctypes.windll.user32.keybd_event(keys[op],0,2,0)
            return {'say':''}
        raise ValueError('Unsupported local action')
