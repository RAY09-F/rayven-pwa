"""Reusable PCM output, immediate cancellation, cached voices and offline SAPI."""
import io
import logging
import threading
import re
import numpy as np
import sounddevice as sd
import soundfile as sf
from config import ROOT
PHRASES=['Clipped.','Done.','On it.','Here, sir.','Here.','Sleeping.','Listening.','OBS was off. It is on now. Say it again.','I can\'t reach the hall.','That took too long.','Say confirm.','Cancelled.','I could not save that clip.','Which app?','There is nothing to repeat.']
def slug(text):
    import hashlib
    return hashlib.sha256(text.encode()).hexdigest()[:20]
class Speaker:
    def __init__(self,brain):
        self.brain=brain;self.cancel=threading.Event();self.lock=threading.RLock();self.stream=None;self.last=None;self.sapi=None
    def stop(self):
        self.cancel.set()
        if self.sapi:
            try:self.sapi.Speak('',3)
            except Exception:logging.warning('SAPI stop failed')
    def output(self,data,rate=24000):
        if self.stream is None:
            self.stream=sd.RawOutputStream(samplerate=24000,channels=1,dtype='int16',blocksize=480);self.stream.start()
        if rate!=24000:
            x=np.frombuffer(data,dtype=np.int16)
            data=np.interp(np.arange(round(len(x)*24000/rate))*rate/24000,np.arange(len(x)),x).astype(np.int16).tobytes()
        for i in range(0,len(data),960):
            if self.cancel.is_set():break
            self.stream.write(data[i:i+960])
    def chime(self,god,tick=False):
        with self.lock:
            if self.cancel.is_set():self.cancel.clear()
            t=np.arange(1800 if tick else 2400)/24000
            f={'thor':300,'loki':750,'odin':480}[god]
            self.output((np.sin(2*np.pi*f*t)*np.sin(np.pi*np.arange(len(t))/len(t))*1300).astype(np.int16).tobytes())
    def say(self,god,text,offline=False):
        with self.lock:
            self.cancel.clear();self.last=(god,text,offline)
            cached=ROOT/'audio'/god/(slug(text)+'.mp3')
            try:
                clock=re.fullmatch(r"It's (\d{1,2}):(\d{2}) (AM|PM)(?:, sir\.|\.)",text)
                if clock:
                    hour,minute,period=clock.groups();minute=int(minute)
                    words=['It is',str(int(hour))]+(['oh',str(minute)] if 0<minute<10 else [str(minute)] if minute else [])+[period]+(['sir'] if god=='thor' else [])
                    files=[ROOT/'audio'/god/(slug(word)+'.mp3') for word in words]
                    if all(p.exists() for p in files):
                        for p in files:
                            if self.cancel.is_set():break
                            data,rate=sf.read(str(p),dtype='int16',always_2d=True);self.output(data[:,0].tobytes(),rate)
                        return
                if cached.exists():
                    data,rate=sf.read(str(cached),dtype='int16',always_2d=True)
                    self.output(data[:,0].tobytes(),rate);return
                if not offline:
                    with self.brain.audio(god,text) as response:
                        pending=b''
                        for chunk in response.iter_content(960):
                            if self.cancel.is_set():return
                            pending+=chunk;size=len(pending)//2*2
                            self.output(pending[:size]);pending=pending[size:]
                    return
            except Exception as e:logging.warning('Voice fallback: %s',type(e).__name__)
            if self.cancel.is_set():return
            try:
                import comtypes.client
                comtypes.CoInitialize();self.sapi=comtypes.client.CreateObject('SAPI.SpVoice')
                self.sapi.Speak(text,1)
                while not self.sapi.WaitUntilDone(20):
                    if self.cancel.is_set():self.sapi.Speak('',3);break
            except Exception as e:logging.error('Output unavailable: %s',type(e).__name__)
    def repeat(self):
        if self.last:self.say(*self.last[:2],offline=self.last[2])
