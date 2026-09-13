"""Render reusable phrases through authenticated Worker, without playing audio."""
import json
import logging
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from config import Config,ROOT
from speak import PHRASES,slug
import requests
def main():
    c=Config();failed=0;done=0
    words=['It is','sir','oh','AM','PM']+[str(i) for i in range(60)]
    for god in ('thor','loki','odin'):
        folder=ROOT/'audio'/god;folder.mkdir(parents=True,exist_ok=True)
        for text in PHRASES+words:
            dest=folder/(slug(text)+'.mp3')
            if dest.exists():continue
            try:
                r=requests.post(c['worker']+'/say',headers={'Authorization':'Bearer '+c.secrets['local_token']},json={'assistant':god,'text':text},timeout=12)
                r.raise_for_status()
                if 'audio/' not in r.headers.get('content-type','') or len(r.content)<100:raise ValueError('No audio')
                dest.write_bytes(r.content);done+=1
            except Exception as e:
                print(f'WARN {god}: voice cache unavailable ({type(e).__name__}); SAPI fallback remains available.');failed+=1;break
    print(f'Rendered {done} phrases; {failed} voice failures.')
    return 1 if failed else 0
if __name__=='__main__':raise SystemExit(main())
