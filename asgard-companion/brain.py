"""Authenticated, bounded Worker calls; never retry a submitted action."""
import requests
from stt import wav
class Brain:
    def __init__(self,config):
        self.config=config;self.stt='none';self.base=config['worker'];self.session=requests.Session()
        self.session.headers['Authorization']='Bearer '+config.secrets['local_token']
    def health(self):
        for base in (self.config['worker'],self.config['fallback']):
            try:
                r=self.session.get(base+'/health',timeout=(2,3));r.raise_for_status();data=r.json()
                if data.get('companionVersion')!=1:continue
                self.base=base;self.stt=data.get('stt','none');return data
            except (requests.RequestException,ValueError):continue
        raise ConnectionError('Worker unavailable')
    def ask(self,god,text,pcm=None):
        if pcm is not None and self.stt=='groq':
            r=self.session.post(self.base+'/ear',data={'assistant':god},files={'audio':('command.wav',wav(pcm),'audio/wav')},timeout=(2,10))
        else:r=self.session.post(self.base+'/ask',json={'assistant':god,'text':text},timeout=(2,10))
        r.raise_for_status();return r.json()
    def audio(self,god,text):
        # POST keeps spoken content out of query-string access logs; GET also supported by Worker.
        r=self.session.post(self.base+'/say',json={'assistant':god,'text':text,'format':'pcm'},stream=True,timeout=(2,8))
        r.raise_for_status();return r
