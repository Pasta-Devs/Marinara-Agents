# Relationship Tracker

Relationship Tracker is a standalone Roleplay tracker by Crimson Orc. It tracks brief relationships between the character cards assigned to a group chat, plus each character's one-way perception of the active persona, and draws them as an editable relationship web inside the Tracker Panel. It does not modify Marinara Engine or another agent.

The package is **staging only** for its first release: Engine `staging` users can install it from **Agents → Download Agents** while it is exercised, and it is hidden from stable users until it graduates.

## Install and enable

Use **Agents → Download Agents** and restart when prompted. Installing the package does not enable it globally: for each Roleplay chat, open **Chat Settings → Agents**, enable agents, add Relationship Tracker under Tracker Agents, and choose a model connection for it. The tracker works with the **Local Sidecar** or any configured API provider.

## Use

- Every assigned character card appears in the web, whether or not that character is currently in the scene. Defined lines use the four fixed color categories: positive, neutral, negative, complicated.
- On desktop, hover or keyboard-focus a line to reveal its label. On touch and pen devices, press a line to reveal its label; press elsewhere in the web to dismiss it. This works for character-to-character lines and character-to-persona spokes.
- The editor uses separate Character A and Character B selectors. Setting a relationship to **Undefined** and saving removes its line. Manual locks stay protected until **Resume automatic updates** is used.
- The active persona renders as a distinct central node with directed spokes for each character's subjective view. Persona headings and accessible labels always use the current active persona name. **Show/Hide Persona** changes only the graphic.
- **Update from History** re-checks a bounded recent window (1-100 messages) through the tracker's selected connection and updates every line that is not locked.
- Prompt injection has two modes. **All relationships** injects every eligible defined line; **Scene-only relationships** injects only lines whose participants qualify as present in the bounded recent-message window (lookback defaults to 15 messages). Undefined relationships are never injected.

The automatic tracker's **Context Size** (recent chat history supplied to the tracker model, default 5 messages), the **Presence lookback** (Scene-only eligibility, default 15 messages), and the **Update from History** message count are three separate controls with separate jobs.

## External read API

Other packages can read the currently defined character-card relationships through the stable, card-only contract:

```text
GET /api/relationship-tracker/v1/chats/:chatId/relationships
```

Persona perceptions remain private package state. An absent or unavailable route must be treated by consumers as no relationship context.
