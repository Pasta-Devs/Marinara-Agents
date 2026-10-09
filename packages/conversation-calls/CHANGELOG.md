# Calls release notes

## 1.1.0 — 2026-10-09

- Mic recording calls use your own speech-to-text server when it is turned on in Connections → Speech to Text (newer Engines). Local Whisper still handles speech when the server is off or fails.
- Speech you record while an earlier clip is still being transcribed now waits its turn instead of being dropped.

## 1.0.17 — 2026-09-19

- Keep calls responsive when Safari blocks voice playback: wait for a new touch or key press, and let stopping a call cancel pending playback.

## 1.0.16 — 2026-09-13 [highlight]

- SwarmUI video connections now generate character call clips using their saved workflow, resolution, frame rate, and LoRAs. Backup SwarmUI connections keep their own workflow settings.

## 1.0.15 — 2026-09-13

- Keep required reasoning enabled for GLM 5.3 on NanoGPT and Z.AI when the selected effort is None.
