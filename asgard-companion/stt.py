"""Command transcription; larger model is loaded only for a spoken command."""
import gc
import io
import json
import wave
from config import ROOT
def wav(pcm:bytes)->bytes:
    out=io.BytesIO()
    with wave.open(out,'wb') as f:f.setnchannels(1);f.setsampwidth(2);f.setframerate(16000);f.writeframes(pcm)
    return out.getvalue()
def recognise(model,pcm:bytes)->str:
    import vosk
    rec=vosk.KaldiRecognizer(model,16000)
    parts=[]
    for i in range(0,len(pcm),8000):
        if rec.AcceptWaveform(pcm[i:i+8000]):parts.append(json.loads(rec.Result()).get('text',''))
    parts.append(json.loads(rec.FinalResult()).get('text',''))
    return ' '.join(parts).strip()
def local(pcm,small,mode='medium'):
    import vosk
    model_path=ROOT/'models/vosk-model-en-us-0.22'
    if mode!='medium' or not model_path.exists():return recognise(small,pcm)
    model=vosk.Model(str(model_path))
    try:return recognise(model,pcm)
    finally:del model;gc.collect()
