# Changelog

## 0.7.1 — 2026-10-14 [highlight]

- When Update from History can't use the model's answer, it now shows the changes the model suggested instead of only an error. Each change uses character names, says in plain words what needs fixing, and can be edited, removed or saved. Relationship changes and persona perceptions are saved separately, and the model's original answer is under Details for bug reports.
- Fewer "unknown character alias" errors: the tracker now tells the model to keep your persona out of character pairs, and a pair it still files with your persona is offered as that character's view of you. The error now names the alias the model used.
- Update from History no longer fails when the model leaves out an empty list.
- After saving only persona perceptions, the panel says how many it saved.

## 0.7.0 — 2026-10-13

- In Roleplay, Update from History now reads whispers the way the Engine's own agents do, marked private with who they were for. A message that is only a whisper is no longer read as empty.
- This needs a Marinara Engine that shares whispers with Agents. On older versions, the tracker keeps reading public messages only.

## 0.6.4 — 2026-10-09 [highlight]

- Fixed Update from History failing with "Persona update 1 must contain exactly five values" when a persona is active. The tracker now tells the model the exact shape of a persona perception, so it stops copying the lock flag into its answer.
- The same fix helps automatic updates, which were quietly skipping those persona perception changes.
- If a model still returns the wrong shape, the error now says how many values it sent.

## 0.6.3 — 2026-10-06

- In the Tracker Panel, Relationship Tracker now has the same collapsible header as World, Persona and the other trackers instead of its own card, and remembers whether you collapsed it. While it runs, the header shows a small spinner.
- In the desktop Trackers window, the drawer's own header is used, and Relationship Tracker's button now matches the other trackers' buttons.

## 0.6.2 — 2026-10-02 [highlight]

- Fixed "Invalid or missing X-Admin-Secret header" when Marinara is opened from another device (LAN, phone, or proxy). The panel now sends the admin secret saved on that device and explains where to save it.
- Update from History falls back to the default agent connection, then the chat's, when no tracker connection is chosen.
- Automatic runs keep valid changes when the model omits an empty list or returns one malformed persona entry.
- Switching persona or removing a card mid-run no longer reports a failed run.
- Tapping a line label or finishing an automatic update no longer wipes unsaved editor text or closes open sections.
- The persona no longer covers a lone character or sits under relationship lines, and its arrowheads show.
- The lock checkbox stays beside its label at Compact width; status colours are readable in the light theme.

## 0.6.1 — 2026-10-01

- The description now says what it does in plain words.

## 0.6.0 — 2026-09-26

- First staging release, with Professor Mari and Crimson Orc sharing pasta as its catalogue cover. Tracks character-card relationships and each character's one-way perception of the active persona in Roleplay group chats, drawn as a fixed-circle relationship web in the Tracker Panel.
- Conservative automatic tracking after each completed reply, a bounded Update from History (1-100 messages), manual editing, optional per-line locks, and Resume Automatic.
- Two prompt-injection modes: All relationships, or Scene-only relationships. Presence lookback (default 15 messages) decides Scene-only eligibility; the automatic tracker's Context Size (default 5) is separate.
- Touch and pen: press a relationship line to reveal its label and press elsewhere to dismiss it; desktop keeps hover and keyboard-focus labels.
- Read-only API for other packages: GET /api/relationship-tracker/v1/chats/:chatId/relationships.
