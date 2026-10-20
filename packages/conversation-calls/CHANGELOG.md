# Calls release notes

## 1.1.7 — 2026-10-20

- When a character changes their status or activity during a call, the change now goes on their character card, as it does after a chat reply, so it shows in every chat and lasts for the time they gave. Before, the call changed only this chat's copy of their schedule, and the change was soon lost. (#1498)

## 1.1.6 — 2026-10-20

- Opening a call no longer changes the volume of, or mutes, a reply Marinara is reading aloud in another chat. The call's voice volume and mute apply only to the call's own voices.
- A call in a chat that uses the Local Model now answers through Marinara's Local Model, as the chat does. Before, it stayed silent and showed no error.

## 1.1.5 — 2026-10-20

- Calls now uses Marinara Engine's own settings, dialogs, voice playback, Local Model, Local Whisper, haptics, Spotify and chat saving instead of carrying copies of them. It no longer resets your Engine settings, starts a second Local Model, or overwrites chat changes saved while a call runs. The download is smaller. It needs a Marinara Engine release after 2.5.0. On 2.5.0 and older, the version you already have keeps working. (#1478, #1487)
- During a call, the connection switcher and the sticker and emoji settings change the call's chat, not another chat.

## 1.1.4 — 2026-10-13

- On phones, the Chat Settings bubble no longer covers the close button in Call Chat. It hides while Call Chat is open and comes back when you close it. (#1338)

## 1.1.3 — 2026-10-13

- With a Claude (Subscription) connection, Calls no longer makes a hidden second request to name each session, and a request now stops with an error if Claude Code turns on claude.ai connectors. With a Marinara Engine release after 2.5.0, Claude Code also no longer adds your account email, the date or this computer's details to the prompt. Engine 2.5.0's Claude Code still adds them, and the server log warns about it until you update Marinara. (#1313)

## 1.1.2 — 2026-10-12 [highlight]

- Characters can call you on their own again. With the call command on, a character who decides to call you now rings with an incoming call. Before this, nothing happened.

## 1.1.1 — 2026-10-09 [highlight]

- Mic recording calls no longer lose some of your speech with "Selected provider/model cannot receive provider-native audio input."
- A call left in a background tab or behind other windows no longer cuts a sentence into pieces at short pauses. It now waits until it has heard about 3 seconds of quiet, so replies there can take a little longer.

## 1.1.0 — 2026-10-09

- Mic recording calls use your own speech-to-text server when it is turned on in Connections → Speech to Text (newer Engines). Local Whisper still handles speech when the server is off or fails.
- Speech you record while an earlier clip is still being transcribed now waits its turn instead of being dropped.

## 1.0.17 — 2026-09-19

- Keep calls responsive when Safari blocks voice playback: wait for a new touch or key press, and let stopping a call cancel pending playback.

## 1.0.16 — 2026-09-13 [highlight]

- SwarmUI video connections now generate character call clips using their saved workflow, resolution, frame rate, and LoRAs. Backup SwarmUI connections keep their own workflow settings.

## 1.0.15 — 2026-09-13

- Keep required reasoning enabled for GLM 5.3 on NanoGPT and Z.AI when the selected effort is None.
