# Sentinel

Check on places and people outside the scene in Roleplay chats.

- **Look:** peek into a room, watch a camera, listen on a monitor, read a sensor, or find a phone.
- **Ask the butler:** type an order such as "turn up the heat in the office" or "lock the front door". The answer says if it worked.
- **Log:** everything you found or changed. The narrator gets these facts before each reply, so the story agrees with them.

Each look or order makes one model call. It uses the Sentinel agent's connection, or the chat's connection when the agent has none.

## Setup

1. Install Sentinel, then add the **Sentinel** agent in Chat Settings → Agents for a Roleplay chat.
2. Open the eye button in the Roleplay toolbar.
3. In **Setup**, pick a play style (Parent, Business owner or Generic) and add the places and people you want to check on.

## Privacy

Every place or person is **open**, **private** or **off-limits**. Private shows presence and activity only. Off-limits cannot be checked. Mark a person as under 18 and they are always private.

## Story checks

When "Notice checks written in the story" is on and you write something like "I look into Lily's room", the narrator gets the known facts about that place. This adds no model call.

## Limits

- Results are stored per chat. A branch starts without the parent chat's results.
- If you delete or rewind the message a result belongs to, that result is dropped.
