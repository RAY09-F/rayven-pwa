"""Positive phrasings and negatives that must never trigger an action."""
import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
import pytest
from fastpath import match,GROUPS
@pytest.mark.parametrize('op,phrase',[(op,p) for op,phrases in GROUPS.items() for p in phrases])
def test_forms(op,phrase):assert match(phrase).op==op
@pytest.mark.parametrize('phrase',['please clip that','clip that please','clip that now','PLEASE CLIP THAT!!!','volume fifty','set volume to 70','volume one hundred','open spotify','launch fortnite','open discord'])
def test_variants(phrase):assert match(phrase)
@pytest.mark.parametrize('phrase',[
    'do not clip that','never save replay','someone said clip that','can you explain volume','the time is wrong','please do not mute',
    'mute Jay on discord','open spotify and delete my files','open powershell','open cmd','open https example com','volume 101',
    'volume minus ten','can we get that later','what is a clip','if I say stop what happens','tell me to go to sleep','he said yes do it',
    'can you research the previous president','next week is busy','the play was good','delete everything','I want to know about steam','save that story for tomorrow'])
def test_negatives(phrase):assert match(phrase) is None
