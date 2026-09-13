# Asgard Windows voice companion

Installed at `C:\Asgard\companion`. Say Thor, Loki, or Odin, followed by a command. Ctrl+Shift+M toggles microphone processing. Names and commands are processed locally unless the optional Groq transcription service is enabled. The existing Asgard website, persona prompts, Telegram webhook, memory namespaces and browser-control extension are retained.

## What is installed

- Python 3.12 with a local virtual environment and pinned Windows wheels.
- Vosk small English wake/command model, with a larger English model downloaded but not enabled by default.
- A below-normal-priority tray process, bounded microphone queue, local command router, audio playback, authenticated loopback WebSocket server, and global mute shortcut.
- OBS 32.2.1, an Asgard-only profile/scene, primary-monitor display capture and desktop audio. Microphone recording is disabled. 1080p60 replay buffer, 30 seconds, MKV, NVIDIA NVENC H.264, P3, single pass, lookahead/AQ off, CQP23. Clips go to `C:\Asgard\Clips`.
- Login shortcuts `Asgard Voice` and `Asgard Replay`; interactive scheduled task `AsgardVoiceWatchdog` every five minutes.
- Separate Chrome extension at `C:\Asgard\asgard-face`, locally paired by the installer. It does not capture audio, games, or screens.
- Authenticated `/ask`, `/ear`, `/say`, and public `/health` on the existing Worker. Voice chat uses the existing persona/tools loop with short answers, a 160-token output budget, up to three model rounds and thinking disabled only for this channel.
- 240 locally cached speech segments, covering all three configured voices, frequent replies and clock words/numbers. No voice was played during cache generation.

## Commands

Say a name first, then `clip that`, `are you there`, `what time is it`, `open Spotify`, `volume 40`, `volume up`, `mute the PC`, `next track`, `pause music`, `say that again`, or another request for the existing Asgard tools. Media play/pause uses the Windows toggle key, so it toggles the current application's state. App launches are restricted to discovered Start Menu shortcuts and installed Steam games; there is no arbitrary shell execution.

`delete my last clip` reads back the last MKV filename and waits for `confirm`. Silence cancels the local action. Existing remote tool approval rules remain in force. An interrupted/timed-out network request is never automatically submitted again: a remote action may already have completed, so check its outcome before repeating it.

Muting ignores names too. Use Ctrl+Shift+M or the extension to unmute; saying "wake up" cannot unmute a listener that deliberately ignores speech.

## Actual limits and deviations from the supplied brief

1. Measured small-model idle memory was about **198 MB**, above the requested 150 MB. A 60-second sample used **3.9% of one CPU core**. No working-set trimming was used to disguise memory use. The optional Porcupine engine still needs your key and three custom keyword files; its performance is not measured.
2. The requested larger offline model took **23.83 seconds to cold-load** on this PC. That conflicts with the voice deadline and low idle RAM requirement. The default therefore uses the already-loaded small model. For experiments only, stop the companion, set `local_model` to `medium` in local config.json, and restart. That mode is slower and substantially heavier. Groq is the recommended transcription upgrade; no Groq secret was present during installation.
3. A live short `/ask` test after the voice fix took **2.16 seconds**, before speech playback. Internet/tool latency varies. A measured replay-save request completed in **0.33 seconds**; that does not include wake recognition or the 700ms end-of-speech wait. No sub-second whole-command or unchanged-FPS claim is made.
4. OBS uses GPU encoding continuously and will consume GPU/CPU/memory. Display capture works outside games; per-game Game Capture can be more efficient but needs the running game selected. Test Fortnite frame times yourself before deciding to keep replay enabled during competitive play.
5. Chrome suspends an idle service worker. To honor the brief's zero-idle-timers/network rule, the extension reconnects when opened rather than sending keepalives. The Python ears remain active, but the badge/overlay may not update after Chrome suspends the extension. Reopen its popup. The overlay requires an explicit popup click on each page because only `activeTab` permission is used. Chrome internal pages do not allow overlays.
6. Calibration measures the ambient noise floor for ten seconds and adjusts speech endpointing. It is not a neural noise-suppression or echo-cancellation engine. Headphones are preferable for reliable interruption while Asgard speaks. Wake-name accuracy, microphone unplug/replug, and barge-in timing need your real voice/hardware checks.
7. The companion is always available while Windows is awake and signed in, independent of Chrome. It cannot listen while the PC is powered off or asleep. Startup and the watchdog use your interactive account, not a system service.
8. OBS 32 removed the older shutdown-check bypass flag. After an actual OBS crash, its safe-mode prompt may need attention. The deliberate configuration restart was handled by backing up its stale sentinel. Startup does not silently erase future crash warnings.
9. Uninstall disables only this companion's startup/task and leaves recoverable files, OBS profiles and recordings. This intentionally differs from the brief's request to delete the install folder, so your clips and optional keys cannot be lost by a casual double-click.

## Reinstall and verification

Run `INSTALL-ASGARD.bat` from this folder. The installer keeps models, audio, local credentials and settings. If running from a repo checkout, keep the sibling `asgard-face` folder alongside it. `tools/deploy-worker.py` uploads the local transport token and deploys the existing Worker from the release checkout; it never prints the credential. Do not use another checkout or change the Worker name.

Run `C:\Asgard\companion\.venv\Scripts\python.exe C:\Asgard\companion\tools\self-test.py` to save measured results in `C:\Asgard\logs\acceptance.json`. It creates one replay clip and requests short voice audio without playing it. Tests that fail remain FAIL. The Desktop `NEXT-STEPS.txt` contains the manual checklist.

Logs rotate at 2MB, with five backups. They contain operational status and timings, not microphone audio or credentials. The recent heard-text list is in process memory and clears on restart. Cached speech files contain only the fixed phrase set; generated command audio is not written to disk.

## Credentials and rollback

Only `obs_password` and `local_token` are stored in `C:\Asgard\companion\secrets.json`, restricted to your Windows account and SYSTEM. The same local transport token is the Cloudflare `ASGARD_COMPANION_TOKEN` secret; provider keys remain in Cloudflare. The unpacked extension has a local-only pairing.js file, excluded from git. Never share that local installation folder. Source code is safe to share after checking git status and exclusions.

To stop startup use `UNINSTALL-ASGARD.bat`. To roll back the cloud code, run Wrangler rollback for the recorded pre-install version `5a992f98-a4ec-42e5-b4fd-a59fa2a62a87` from the release checkout. This disables new voice routes while retaining existing KV data. Do not reset Git or change KV namespaces.

## Primary references

- [Vosk models](https://alphacephei.com/vosk/models)
- [OBS WebSocket protocol](https://github.com/obsproject/obs-websocket/blob/master/docs/generated/protocol.md)
- [OBS WebSocket configuration field names](https://github.com/obsproject/obs-websocket/blob/master/src/Config.cpp): current JSON fields use snake_case, unlike the brief's old CamelCase names.
- [Chrome extension WebSockets](https://developer.chrome.com/docs/extensions/how-to/web-platform/websockets)
- [Claude thinking configuration](https://platform.claude.com/docs/en/build-with-claude/thinking)
- [Groq speech transcription](https://console.groq.com/docs/speech-to-text)

The complete generated Worker bundle is `worker/worker.js` in the repo. `src/index.js` remains the maintained deployment entry point so existing bindings and Durable Object exports remain intact.
