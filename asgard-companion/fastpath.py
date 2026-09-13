"""Exact, bounded local commands; never substring-match arbitrary conversation."""
import re
from dataclasses import dataclass
@dataclass(frozen=True)
class Action:
    op: str
    value: str | int | None = None
def normalise(text: str) -> str:
    return re.sub(r'\s+',' ',re.sub(r'[^\w\s]',' ',text.lower())).strip()
GROUPS = {
    'clip': ['clip that','clip it','clip','save that','save the clip','save replay','get that'],
    'mute': ['mute','go to sleep','stop listening','quiet'],
    'unmute': ['wake up','start listening'],
    'stop': ['stop','shut up','enough'],
    'volume_up': ['volume up','louder','turn the volume up'],
    'volume_down': ['volume down','quieter','turn the volume down'],
    'pc_mute': ['mute the pc','mute the computer'],
    'pc_unmute': ['unmute the pc','unmute the computer'],
    'play_pause': ['pause','play','pause music','play music'],
    'next': ['next','skip','next track','skip track'],
    'previous': ['previous','back one','previous track'],
    'time': ['what time is it','time','tell me the time'],
    'status': ['are you there','status','can you hear me'],
    'repeat': ['say that again','repeat','repeat that'],
    'confirm': ['confirm','yes do it'],
    'cancel': ['cancel','never mind'],
    'delete_last_clip': ['delete my last clip','delete the last clip'],
}
WORDS = {'zero':0,'ten':10,'twenty':20,'thirty':30,'forty':40,'fifty':50,'sixty':60,'seventy':70,'eighty':80,'ninety':90,'one hundred':100}
def match(text: str) -> Action | None:
    t = normalise(text)
    t = re.sub(r'^please\s+','',t)
    t = re.sub(r'\s+(?:please|now)$','',t)
    t = re.sub(r'\s+(?:please|now)$','',t)
    for op, forms in GROUPS.items():
        if t in forms: return Action(op)
    m = re.fullmatch(r'(?:set )?volume(?: to)? (.+)',t)
    if m:
        v = WORDS.get(m[1], int(m[1]) if m[1].isdigit() else -1)
        if 0 <= v <= 100: return Action('volume',v)
    m = re.fullmatch(r'(?:open|launch) ([a-z0-9][a-z0-9 ]{0,79})',t)
    if m and not re.search(r'\b(and|then|delete|send|http|https|powershell|cmd|terminal|script)\b',m[1]): return Action('open',m[1])
    return None
