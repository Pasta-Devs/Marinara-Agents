# Player feedback, October 2026 (Discord, "Slurp 0.3.12 - Follow Up" thread)

Collected 2026-10-05 from the #me-bugs-features thread. Each item: who reported it, what they
want, and a first read of where it lives. Not triaged against code yet.

## Bugs

| # | Report | Reporter | First read |
| - | --- | --- | --- |
| B1 | Role-play Creator sign-up: picking the suggested replies works, but typing a custom reply fails every time ("reply is lost"). | HarlanRyudo | The scene's free-text turn (`slp-scene-turn-service.ts` / `readSlpSceneTurn`): the model's answer to a typed line does not parse or is dropped. Reproduce first. |
| B2 | DM stuck on "Riley is already writing back. Give it a moment." Get reply now does not clear it. Happened after the player deleted message files in `slurp2_messages` to retry. | The Lord of the Backdoor | A pending-reply marker outlives its messages. The pending state must expire, and Get reply now must clear a marker whose turn no longer exists. |
| B3 | Pulse keeps "creating first post" for new Creators after the posts exist, also after an Engine restart. | Bloo | The first-post task is never marked done when the posts land (task store or first-post status poll). |

## Requests

| # | Request | Reporter | First read |
| - | --- | --- | --- |
| R1 | Support desk: Creators keep asking for things Slurp does not have (badges), and "my earnings are low" tickets repeat. | Terahurts, gunterlie | Desk ticket topics must come only from levers that exist; vary topics; cool down a topic per Creator. See `SUPPORT-DESK.md`. |
| R2 | Quick replies for the desk ("I need a script I can cut and paste"). | Terahurts | Saved answers per ticket topic, one tap to send. |
| R3 | A "family" tie that never turns romantic. Slurp made a mother and daughter a couple. | Terahurts | New tie kind in `slp-drama.ts` / ties; couple and drama casting must skip family pairs. |
| R4 | Stop a pair from starting a relationship (today ties can only be removed, and come back). | thatonecan | A "never pair" block per Creator pair that casting and couple set-up respect. |
| R5 | A way to turn off the cooldown on redeeming money. | GodHandGriffith | Find the redeem cooldown in the wallet; expose it in Settings › Fans & money (no hidden fixed cooldowns). |
| R6 | Role-play onboarding to update an existing Creator ("char wants to update their page"), for old Creators missing fields such as hard nos. | ylliselmanii | Reuse the sign-up scene with an "update" preset that fills missing page fields. |
| R7 | Fan Requests settings: an editable list of "what the fan wants" (the commission asks: "something soft", "your usual style"), next to the editable first words. | thatonecan | Move `COMMISSION_ASKS` into settings like `messagesCommissionOpeners`. |
| R8 | A Creator answering the player persona's comment should know them from DMs, not treat them as a stranger. | The Lord of the Backdoor | Comment-reply prompt: add the persona's DM relationship and recent DM gist when the commenter is the player. |
| R9 | Edit or delete DM messages and regenerate a Creator's reply. | The Lord of the Backdoor | DM thread actions: edit own, delete, regenerate last Creator reply. |
| R10 | Export a DM thread, or better a summary, to paste into lorebooks or the Long-Term Memory agent. | Terahurts | Thread menu: copy as text, and a "Summarize" assist action on the AI budget. |

Positive note: Minimax M3 (via Nano) gives Creators distinct voices in chat (Terahurts).
