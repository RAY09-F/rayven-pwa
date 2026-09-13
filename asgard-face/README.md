# Asgard face

Load **C:\Asgard\asgard-face** using Chrome's Load unpacked button. This installed copy is already paired. Do not share its pairing.js; source copies deliberately omit it. If using an unpaired source copy, open extension Options and enter only the local_token from your own companion's secrets.json. Never enter an API key.

The popup shows state, last heard text, mute/unmute and setup. Setup includes sensitivity, bare-name window, replay length, tests and the latest 50 in-memory events. "Enable face on this page" grants that page a temporary status pill. No broad website access, background microphone or game capture is requested.

There are no idle polling timers. Chrome can suspend the service worker, so reopen the popup to restore the connection; an idle badge can be stale. The Windows companion keeps working with Chrome closed. Overlays cannot run on Chrome internal pages and require a user click after a new page is loaded. This is the deliberate tradeoff for narrow activeTab access and zero idle network traffic.
