# Calls release notes

## 1.0.18 — 2026-09-30

- Send the first device cue in a call reply before speech, and require a real cue when a character says they changed or retried the device.
- Describe Intiface motor output accurately for pump and stroker devices even when the API labels their control `vibrate`.
- Call cues now list only actions exposed by connected devices, so devices with a `vibrate`-labeled motor output receive usable pacing commands.
- Call haptic commands now play in order with spoken turns instead of firing while the reply is being saved. Stopping or interrupting the call stops active feedback.
- Add a per-chat Haptics during calls switch so call cues can be enabled without also enabling inline haptic commands in text chat.

## 1.0.17 — 2026-09-19

- Keep calls responsive when Safari blocks voice playback: wait for a new touch or key press, and let stopping a call cancel pending playback.

## 1.0.16 — 2026-09-13 [highlight]

- SwarmUI video connections now generate character call clips using their saved workflow, resolution, frame rate, and LoRAs. Backup SwarmUI connections keep their own workflow settings.

## 1.0.15 — 2026-09-13

- Keep required reasoning enabled for GLM 5.3 on NanoGPT and Z.AI when the selected effort is None.
