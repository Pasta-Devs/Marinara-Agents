# Changelog

## 0.6.0 — 2026-09-26

- First staging release, with Professor Mari and Crimson Orc sharing pasta as its catalogue cover. Tracks character-card relationships and each character's one-way perception of the active persona in Roleplay group chats, drawn as a fixed-circle relationship web in the Tracker Panel.
- Conservative automatic tracking after each completed reply, a bounded Update from History (1-100 messages), manual editing, optional per-line locks, and Resume Automatic.
- Two prompt-injection modes: All relationships, or Scene-only relationships. Presence lookback (default 15 messages) decides Scene-only eligibility; the automatic tracker's Context Size (default 5) is separate.
- Touch and pen: press a relationship line to reveal its label and press elsewhere to dismiss it; desktop keeps hover and keyboard-focus labels.
- Read-only API for other packages: GET /api/relationship-tracker/v1/chats/:chatId/relationships.
