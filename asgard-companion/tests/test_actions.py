"""Deletion requires a live confirmation bound to one exact file and persona."""
import time
from types import SimpleNamespace
from actions import Actions
from fastpath import Action
def subject(tmp_path):
    a=Actions.__new__(Actions);a.pending=None;a.app=SimpleNamespace(config={'clips':str(tmp_path)})
    return a
def test_delete_requires_confirmation(tmp_path):
    path=tmp_path/'recording.mkv';path.write_bytes(b'test')
    a=subject(tmp_path);assert a.run(Action('delete_last_clip'),'thor')['needsConfirm'];assert path.exists()
    assert a.run(Action('confirm'),'thor')['say']=='Done.';assert not path.exists()
def test_wrong_persona_cannot_confirm(tmp_path):
    path=tmp_path/'recording.mkv';path.write_bytes(b'test');a=subject(tmp_path)
    a.run(Action('delete_last_clip'),'thor');assert a.run(Action('confirm'),'loki')['say']=='Cancelled.';assert path.exists()
def test_expired_action_keeps_file(tmp_path):
    path=tmp_path/'recording.mkv';path.write_bytes(b'test');a=subject(tmp_path);a.pending=(path,time.monotonic()-1,'thor')
    assert a.run(Action('confirm'),'thor')['say']=='Cancelled.';assert path.exists()
def test_cancel_keeps_file(tmp_path):
    path=tmp_path/'recording.mkv';path.write_bytes(b'test');a=subject(tmp_path)
    a.run(Action('delete_last_clip'),'thor');a.run(Action('cancel'),'thor');assert path.exists();assert a.pending is None
