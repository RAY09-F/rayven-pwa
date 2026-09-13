# Verification — September 13, 2026

Cloud Worker version: b4370f11-1354-4457-81fe-ceae6446f9b7.

182 repository tests and 90 companion tests passed. Three synthetic WAV tests correctly recognized Thor, Loki and Odin followed by are you there. No test speech was played through the speakers.

Chrome Asgard face installed and paired in the Rayan profile; extension ID nhfcohgddcmbejjbgklcgfoonniloihe. Existing ASGARD Browser Control 1.4 remains enabled.

Live short voice chat returned Ready, sir. in 2.16 seconds. All three TTS routes returned audio. Cached 240 phrase/clock segments.

- PASS — Companion running below-normal:
- PASS — Authenticated WebSocket status:
- PASS — OBS replay active: {'running': True, 'replay': True, 'profile': 'Asgard', 'capture_width': 1920.0, 'capture_height': 1080.0}
- PASS — Tray icon visible:
- PASS — Display capture has real dimensions:
- PASS — Wrong token refused:
- PASS — Confirmed replay saved within 2s: 1.094s; C:\Asgard\Clips\Replay 2026-09-13 06-33-58.mkv
- PASS — Worker health:
- PASS — Voice bytes thor: HTTP 200; 24520 bytes (not played)
- PASS — Voice bytes loki: HTTP 200; 24520 bytes (not played)
- PASS — Voice bytes odin: HTTP 200; 26750 bytes (not played)
- PASS — Fast-path tests: ........................................................................ [ 80%] ..................                                                       [100%] 90 passed in 0.11s
- PASS — Login shortcuts:
- PASS — Watchdog registered:
- PASS — Idle CPU <=5% of one core: 3.80%
- FAIL — Idle RAM <=150MB: 196.3 MB
- PASS — Watchdog restarts killed companion: 2.05s

The memory cap is unmet. No claim of full acceptance, zero Fortnite FPS impact, subsecond spoken interaction, real-voice wake accuracy or microphone hot-plug reliability is made. Manual checks are in NEXT-STEPS.txt.
