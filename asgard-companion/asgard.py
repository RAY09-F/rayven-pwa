"""Asgard tray service: local wake words, bounded voice turns, and authenticated controls."""
import collections
import ctypes
import gc
import json
import logging
from logging.handlers import RotatingFileHandler
import os
import queue
import re
import threading
import time
import numpy as np
import psutil
import pystray
import vosk
from PIL import Image,ImageDraw
from config import Config,ROOT
from audio import Audio,Capture,energy
from wake import build
from stt import recognise,local
from fastpath import match
from brain import Brain
from speak import Speaker
from obs import OBS
from actions import Actions
from server import Server
class App:
    def __init__(self):
        self.config=Config();self.god='thor';self.state='idle';self.text='';self.heard='';self.errors={};self.generation=0;self.reload_wake=False;self.confirm_remote=False
        self.lock=threading.RLock();self.stop=threading.Event();self.history=collections.deque(maxlen=50);self.work=queue.Queue(maxsize=1);self.icon=None
        self.confirm_frames=None
        self.brain=Brain(self.config);self.speaker=Speaker(self.brain);self.obs=OBS(self.config);self.server=Server(self);self.audio=Audio(self.config,self.health);self.actions=Actions(self)
        self.model=vosk.Model(str(ROOT/'models/vosk-model-small-en-us-0.15'));self.wake=build(self.model,self.config['sensitivity']);self.threads={}
    def health(self,part,error):
        with self.lock:
            if error:self.errors[part]=error
            else:self.errors.pop(part,None)
        if error:logging.warning('%s: %s',part,error)
        self.publish()
    def status(self):return dict(god=self.god,state=self.state,text=self.text,heard=self.heard,muted=self.config['muted'],errors=dict(self.errors),pid=os.getpid(),wake=getattr(getattr(self,'wake',None),'name','loading'),stt=self.brain.stt if self.brain.stt=='groq' else self.config['local_model'],events=list(self.history),settings={k:self.config[k] for k in ('sensitivity','clip_seconds','command_window')})
    def diagnostics(self):return self.status()|{'obs':self.obs.status(),'microphone':self.audio.device_name,'dropped_frames':self.audio.dropped,'apps':len(self.actions.apps),'tray_visible':bool(self.icon and self.icon.visible)}
    def publish(self):
        if hasattr(self,'server'):self.server.push(self.status())
        if self.icon:
            color='#e74747' if self.errors else '#666666' if self.config['muted'] else {'thor':'#47b3ff','loki':'#087f32','odin':'#ffb324'}[self.god]
            im=Image.new('RGBA',(64,64));d=ImageDraw.Draw(im);d.polygon([(32,5),(59,53),(5,53)],fill=color);d.polygon([(32,22),(43,44),(21,44)],fill='#101318')
            self.icon.icon=im;self.icon.title=('Asgard: '+(next(iter(self.errors.values())) if self.errors else 'Muted' if self.config['muted'] else self.state))[:120]
    def set_state(self,state,text=None):
        self.state=state
        if text is not None:self.text=text
        self.publish()
    def mute(self,value):
        self.config.save({'muted':value});self.generation+=1;self.speaker.stop();self.state='idle';self.publish()
    def wake_audio(self):
        calibration=[];calibration_start=time.monotonic();need=time.time()-self.config['calibrated_at']>7*86400
        capture=None;cooldown=0.;last_frame=time.monotonic();was_missing=False
        while not self.stop.is_set():
            try:pcm=self.audio.frames.get(timeout=2)
            except queue.Empty:
                if time.monotonic()-last_frame>4:self.health('mic','No microphone frames; reconnect the microphone.');was_missing=True
                continue
            last_frame=time.monotonic()
            if was_missing:self.health('mic',None);was_missing=False
            if not need and self.state=='idle' and time.time()-self.config['calibrated_at']>7*86400:
                need=True;calibration=[];calibration_start=time.monotonic()
            if need:
                calibration.append(energy(pcm))
                if time.monotonic()-calibration_start>=10:
                    self.config.save({'noise_floor':max(40,float(np.percentile(calibration,25))),'calibrated_at':time.time()});need=False
                continue
            if self.config['muted']:capture=None;self.audio.ring.clear();continue
            if self.confirm_frames is not None:
                try:self.confirm_frames.put_nowait(pcm)
                except queue.Full:pass
                continue
            if self.reload_wake:self.wake=build(self.model,self.config['sensitivity']);self.reload_wake=False
            if capture:
                if capture.feed(pcm):
                    finished=capture;capture=None
                    if not finished.voiced:self.set_state('idle');continue
                    self.set_state('working')
                    try:self.work.put_nowait((self.generation,self.god,finished.pcm()))
                    except queue.Full:self.health('busy','A previous request is still finishing.');self.set_state('idle')
                    cooldown=time.monotonic()+.3
                continue
            self.audio.ring.append(pcm)
            if time.monotonic()<cooldown:continue
            god=self.wake.feed(pcm)
            if god:
                self.generation+=1;self.speaker.stop();self.god=god;self.confirm_remote=False;self.set_state('listening','')
                capture=Capture(self.config);self.audio.ring.clear()
                threading.Thread(target=self.speaker.chime,args=(god,),daemon=True).start();cooldown=time.monotonic()+.6
    def process(self):
        while not self.stop.is_set():
            try:gen,god,pcm=self.work.get(timeout=1)
            except queue.Empty:continue
            try:
                started=time.monotonic()
                if gen!=self.generation:continue
                heard=recognise(self.model,pcm)
                heard=re.sub(r'^\s*(thor|loki|odin)\b[\s,.]*','',heard,flags=re.I).strip()
                if not heard:
                    self.set_state('idle');continue
                self.heard=heard;self.history.append({'at':time.time(),'god':god,'heard':heard});self.publish()
                action=match(heard)
                if gen!=self.generation:continue
                if action:
                    result=self.actions.run(action,god);offline=True
                else:
                    tick=threading.Timer(2.5,lambda:self.speaker.chime(god,True) if gen==self.generation and self.state=='working' else None);tick.daemon=True;tick.start()
                    # A 12-second overall deadline suppresses late speech, but NEVER retries the request.
                    if self.brain.stt!='groq':heard=local(pcm,self.model,self.config['local_model']);heard=re.sub(r'^\s*(thor|loki|odin)\b[\s,.]*','',heard,flags=re.I).strip()
                    if time.monotonic()-started>=12:raise TimeoutError('Local transcription exceeded deadline')
                    if gen!=self.generation:continue
                    result=self.brain.ask(god,heard,pcm if self.brain.stt=='groq' else None);offline=False
                    tick.cancel()
                    self.health('worker',None)
                    if time.monotonic()-started>=12:raise TimeoutError('Voice response exceeded deadline; request was not retried')
                if gen!=self.generation:continue
                reply=result.get('say','')
                self.health('busy',None)
                if reply:
                    self.set_state('speaking',reply);self.speaker.say(god,reply,offline=offline)
                if result.get('needsConfirm') and gen==self.generation:
                    # Listen immediately for one confirmation; it is tied to this action and persona.
                    self.confirm_frames=queue.Queue(maxsize=450)
                    if offline and self.actions.pending:
                        path,_,owner=self.actions.pending;self.actions.pending=(path,time.monotonic()+8,owner)
                    self.set_state('listening');confirmation=Capture(self.config)
                    confirm_pcm=[];deadline=time.monotonic()+8
                    while time.monotonic()<deadline:
                        try:frame=self.confirm_frames.get(timeout=.3)
                        except queue.Empty:continue
                        confirm_pcm.append(frame)
                        if confirmation.feed(frame) and confirmation.voiced:break
                    self.confirm_frames=None
                    if gen!=self.generation:continue
                    answer=match(recognise(self.model,b''.join(confirm_pcm)))
                    if answer and answer.op in ('confirm','cancel'):
                        if offline:out=self.actions.run(answer,god)
                        else:out=self.brain.ask(god,'yes' if answer.op=='confirm' else 'cancel')
                        self.set_state('speaking',out.get('say',''));self.speaker.say(god,out.get('say','Cancelled.'),offline=offline)
                    else:
                        self.actions.pending=None
                        if not offline:
                            try:self.brain.ask(god,'cancel')
                            except Exception:logging.warning('Remote cancellation unavailable; do not confirm that request later.')
                        self.speaker.say(god,'Cancelled.',offline=True)
                logging.info('Voice turn finished: persona=%s local=%s elapsed_ms=%d',god,offline,round((time.monotonic()-started)*1000))
            except Exception as e:
                logging.warning('Voice turn failed: %s',type(e).__name__)
                if gen==self.generation:
                    reply='That took too long.' if isinstance(e,TimeoutError) else "I can't reach the hall."
                    self.set_state('speaking',reply);self.speaker.say(god,reply,offline=True)
            finally:
                self.confirm_frames=None
                if gen==self.generation:self.set_state('idle')
                self.work.task_done()
    def run(self):
        from pynput import keyboard
        self.hotkey=keyboard.GlobalHotKeys({'<ctrl>+<shift>+m':lambda:self.mute(not self.config['muted'])});self.hotkey.start()
        jobs={'audio':self.audio.run,'wake':self.wake_audio,'server':self.server.run,'commands':self.process}
        def supervise():
            while not self.stop.is_set():
                for name,job in jobs.items():
                    if name not in self.threads or not self.threads[name].is_alive():
                        def guarded(fn=job,label=name):
                            try:fn()
                            except Exception as e:logging.exception('Thread %s failed',label);self.health(label,type(e).__name__)
                        self.threads[name]=threading.Thread(target=guarded,name=name,daemon=True);self.threads[name].start()
                self.stop.wait(3)
        threading.Thread(target=supervise,daemon=True).start()
        def initial():
            try:self.brain.health();self.health('worker',None)
            except Exception:self.health('worker','Worker offline; local commands still work.')
            try:self.obs.connect();self.health('obs',None)
            except Exception:self.health('obs','OBS unavailable; clip command will try to start it.')
        threading.Thread(target=initial,daemon=True).start()
        self.icon=pystray.Icon('Asgard',Image.new('RGB',(64,64),'#47b3ff'),'Asgard',menu=pystray.Menu(pystray.MenuItem('Mute / unmute',lambda:self.mute(not self.config['muted'])),pystray.MenuItem('Open setup',lambda:os.startfile(str(ROOT/'SETUP.html')))))
        self.publish();self.icon.run()
def main():
    (ROOT.parent/'logs').mkdir(exist_ok=True)
    handler=RotatingFileHandler(ROOT.parent/'logs/asgard.log',maxBytes=2*1024*1024,backupCount=5,encoding='utf-8')
    logging.basicConfig(level=logging.INFO,handlers=[handler],format='%(asctime)s %(levelname)s %(message)s')
    logging.getLogger('obsws_python').setLevel(logging.CRITICAL)
    mutex=ctypes.windll.kernel32.CreateMutexW(None,False,'Local\\AsgardVoiceCompanion')
    if ctypes.windll.kernel32.GetLastError()==183:return
    psutil.Process().nice(psutil.BELOW_NORMAL_PRIORITY_CLASS);vosk.SetLogLevel(-1)
    (ROOT/'asgard.pid').write_text(str(os.getpid()))
    App().run()
if __name__=='__main__':
    try:main()
    except Exception:logging.exception('Companion startup failed')
