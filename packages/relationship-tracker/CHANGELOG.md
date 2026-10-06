# Changelog

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
