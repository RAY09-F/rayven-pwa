# Using the improved ASGARD interface

Choose **Thor**, **Loki** or **Odin** at the top. Each keeps its own draft and displayed conversation while this page remains open. Reloading does not restore the displayed transcript; existing backend memory is separate.

## Type a message

Click the message field, type, then press Enter or the arrow button. Shift + Enter inserts a new line. The two starter prompts fill the field; they do not send automatically.

The assistant shows Thinking while waiting. A failed message offers **Restore message to retry**, which returns it to the composer without sending it again. Review it and send when ready. Long replies scroll within conversation; code blocks can scroll horizontally inside their own box.

## Voice

**Start listening** enables the existing wake-listening flow if your browser supports it. Allow microphone access in your own browser if prompted. Wait for the status to confirm listening, then say “Hey Thor,” “Hey Loki,” or “Hey Odin.” Browser support and permissions vary; typing remains available.

**Stop listening** turns off microphone input. It does not mute the assistant's output. **Stop speaking**, shown while speech is being prepared or played, interrupts output. In **Settings**, turn off **Spoken replies** to keep future replies text-only. That preference is separate from microphone input and persists when browser storage is available.

Real microphone/provider speech was not tested in the implementation environment. Existing wake/switch/sleep vocabulary and backend voice routing were retained.

## Understand the status

| Label | Meaning |
| --- | --- |
| Ready when you are | No active request, speech or confirmed microphone state |
| Starting microphone | Waiting for the browser to start input; this does not mean permission succeeded |
| Listening for your call | Microphone has started in the existing wake mode |
| Listening | Microphone has started in the conversation mode |
| Thinking | A chat request is pending |
| Preparing voice | The text reply exists; spoken output is being prepared |
| Speaking | Playback/start was reported by the audio system |
| Needs attention | Read the error in conversation; typing remains available |

Movement and color are supplementary. The text label is the primary state indication. The model is not a measured microphone waveform or confidence meter.

## Keep the screen comfortable

Open Settings for **Still mode**, **Spoken replies** and **Rendering**. Balanced is the default lower-resource rendering choice. High increases the rendering budget; it is not a guarantee of a particular frame rate. System reduced motion is respected even if Still mode is unchecked.

Settings also links to the existing Council and Bifrost pages. No extra tool platform or modeling interface has been added.

Use **Minimize conversation** to give the core more room. **Open conversation** restores the panel and focuses its message field. Escape closes Settings; focus returns to its button. Number keys 1, 2 and 3 switch personas when you are not editing text or inside Settings.

## On a phone

The core sits above conversation. The message field stays readable rather than shrinking a desktop dashboard. Focusing conversation makes the scene more compact. Scroll the conversation to read longer replies and scroll the page if your screen or keyboard leaves less room.

## If the scene or voice is unavailable

A **simplified still view** means this browser is using the fallback rendering path. Conversation still works. If all rendering fails, ASGARD displays a calm identity fallback instead. Reloading may recover a lost graphics context; the page does not promise automatic recovery.

For microphone errors, check permission, the input device or connection according to the displayed message. You can always use the message field. For reply errors, restore the message and try again after checking your connection. This upgrade does not change your provider accounts, billing or backend deployment.
