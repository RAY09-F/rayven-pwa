"""Bounded microphone queue, communications-device selection, and endpointing."""
import collections
import logging
import queue
import time
import numpy as np
import sounddevice as sd
def energy(pcm: bytes) -> float:
    x=np.frombuffer(pcm,dtype=np.int16).astype(np.float32)
    return float(np.sqrt(np.mean(x*x))) if len(x) else 0.0
def communications_device():
    # MMDevice role 2 is Windows' communications endpoint. Match its friendly name
    # to PortAudio WASAPI; use the default input only if it cannot be mapped.
    try:
        import comtypes
        from pycaw.pycaw import AudioUtilities
        comtypes.CoInitialize()
        endpoint=AudioUtilities.GetDeviceEnumerator().GetDefaultAudioEndpoint(1,2)
        device=AudioUtilities.CreateDevice(endpoint)
        name=device.FriendlyName
        candidates=[(i,d) for i,d in enumerate(sd.query_devices()) if d['max_input_channels'] and d['name']==name]
        wasapi=[(i,d) for i,d in candidates if 'WASAPI' in sd.query_hostapis(d['hostapi'])['name']]
        return (wasapi or candidates)[0][0] if candidates else None
    except Exception as e:
        logging.warning('Communications microphone lookup failed: %s',type(e).__name__)
        return None
class Audio:
    def __init__(self,config,health):
        self.config=config;self.health=health;self.frames=queue.Queue(maxsize=150);self.stop=False
        self.dropped=0;self.device_name='';self.ring=collections.deque(maxlen=18)
    def run(self):
        while not self.stop:
            try:
                device=communications_device()
                info=sd.query_devices(device,'input');self.device_name=info['name']
                rate=16000
                try: sd.check_input_settings(device=device,channels=1,dtype='int16',samplerate=rate)
                except Exception: rate=int(info['default_samplerate'])
                last_callback=[time.monotonic()]
                def callback(indata,frames,clock,status):
                    last_callback[0]=time.monotonic()
                    if status: self.dropped+=1
                    data=bytes(indata)
                    if rate != 16000:
                        # Integer-rate microphone resampling only, cheap and bounded.
                        x=np.frombuffer(data,dtype=np.int16)
                        data=np.interp(np.arange(320)*rate/16000,np.arange(len(x)),x).astype(np.int16).tobytes()
                    try:self.frames.put_nowait(data)
                    except queue.Full:self.dropped+=1
                with sd.RawInputStream(device=device,samplerate=rate,blocksize=round(rate*.02),channels=1,dtype='int16',callback=callback) as stream:
                    self.health('mic',None)
                    next_device_check=time.monotonic()+10
                    while not self.stop:
                        time.sleep(1)
                        if not stream.active or time.monotonic()-last_callback[0]>3:
                            raise ConnectionError('Microphone stream stopped')
                        if time.monotonic()>=next_device_check:
                            next_device_check=time.monotonic()+10
                            if communications_device()!=device:break
            except Exception as e:
                logging.warning('Microphone disconnected/unavailable: %s',type(e).__name__)
                self.health('mic','Microphone unavailable; reconnect it or select a Windows input.')
                time.sleep(3)
class Capture:
    def __init__(self,config,pre=b''):
        self.config=config;self.start=time.monotonic();self.last=self.start;self.voiced=False;self.data=[pre] if pre else []
    def feed(self,pcm):
        now=time.monotonic();self.data.append(pcm)
        threshold=max(110,float(self.config['noise_floor'])*(3.5-self.config['sensitivity']*2))
        if energy(pcm)>threshold:self.voiced=True;self.last=now
        return (self.voiced and now-self.last>=self.config['silence_ms']/1000) or now-self.start>= (self.config['max_command'] if self.voiced else self.config['command_window'])
    def pcm(self):return b''.join(self.data)
