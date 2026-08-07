# Tindler — rank 6

Status: **decided**.

## Findings
- Matches are a dead end — no chat, no unmatch, no removal.
- Deck never auto-refills; you hit "That's everyone for now."
- No undo on a pass.
- Profiles are name-hashed gradient + initials; no imagery even though Gallery holds real images.
- Preferences save to the store on every keystroke.

## Decisions

- **Matching opens a Messages thread** — a match becomes a real contact you can text. This is the fix
  for the dead end, and ties Tindler into the rest of the phone.
- **Generated profile photos** via the image pipeline (see `01-camera.md`) instead of gradient+initials.
  **Generation timing:** pre-generate a first batch when the app is installed, then generate lazily
  (on the card actually being shown) from then on. Avoids both a cold empty deck and paying for
  ten images the user swipes past in three.
- **Undo last swipe.**

## Explicitly not doing
- Auto-refilling the deck at the end. The "That's everyone for now" empty state with a manual
  "Find new people" button stays.

## Also
- Debounce the preferences field (currently writes to the store on every keystroke).

> **Profile photos blocked** — see [16-engine-interop.md](16-engine-interop.md).
