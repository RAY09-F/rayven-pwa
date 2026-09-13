"""Offline wake engines; keep the Vosk vocabulary bounded to the three names."""
import json
from config import ROOT
NAMES = ('thor','loki','odin')
class VoskWake:
    name = 'vosk'
    def __init__(self, model, sensitivity=0.5):
        import vosk
        self.model = model
        self.rec = vosk.KaldiRecognizer(model,16000,json.dumps([*NAMES,'[unk]']))
        self.rec.SetWords(True)
    def feed(self, pcm):
        if self.rec.AcceptWaveform(pcm): result=json.loads(self.rec.Result()).get('text','')
        else: result=json.loads(self.rec.PartialResult()).get('partial','')
        words=result.split()
        name=next((x for x in words if x in NAMES),None)
        if name: self.rec.Reset()
        return name
    def reset(self): self.rec.Reset()
class PorcupineWake:
    name='porcupine'
    def __init__(self,sensitivity):
        import pvporcupine
        self.engine=pvporcupine.create(access_key=(ROOT/'picovoice.key').read_text().strip(),keyword_paths=[str(ROOT/'keywords'/f'{x}.ppn') for x in NAMES],sensitivities=[sensitivity]*3)
        self.buffer=bytearray()
    def feed(self,pcm):
        import struct
        self.buffer.extend(pcm)
        length=self.engine.frame_length*2
        while len(self.buffer)>=length:
            frame=bytes(self.buffer[:length]);del self.buffer[:length]
            index=self.engine.process(struct.unpack('<'+'h'*self.engine.frame_length,frame))
            if index>=0:return NAMES[index]
        return None
    def reset(self): self.buffer.clear()
def build(model,sensitivity):
    ready=(ROOT/'picovoice.key').exists() and all((ROOT/'keywords'/f'{x}.ppn').exists() for x in NAMES)
    if ready:
        try:return PorcupineWake(sensitivity)
        except Exception:
            import logging
            logging.warning('Picovoice could not initialize; using offline Vosk wake detection.')
    return VoskWake(model,sensitivity)
