# Calls — new app

Status: **decided**. Did not exist in the original 13.

The Engine has a complete call model (`db/schema/conversation-calls.ts` →
`conversation_call_sessions`) and the device that should obviously surface it has no dialer:

- status: `ringing` | `active` | `ended` | `declined` | `missed`
- mode: `audio` | `video`
- **`initiator: user | character`** — characters can call you
- per chat, with a `summary` written after the call

## Decision — full calls app
- **Dialer** — place a call from the phone to a contact.
- **Call log** — history including missed and declined, using the existing status states.
- **Incoming call screen** — a ringing surface when a character calls you, with accept/decline.

Uses the existing session model rather than inventing a parallel one. Declining from the phone should
write `declined`; not answering should land as `missed` — the states already exist and carry story meaning.

## Dependencies
- **Package API access to conversation call sessions** — not currently in the `CapabilityContext`
  contract. Same class of change as the image capability (see `16-engine-interop.md`).
- The incoming-call screen needs the phone to be reachable while closed — ties to notifications and
  the buzz/lock-screen work in `00-platform.md` and `15-rp-integration.md`.
- Post-call `summary` is a natural thing to surface in the log.
- **Prerequisite:** collapse the seven-site app registration in `index.tsx` first — see
  [`18-device-shell.md`](18-device-shell.md). Adding a fourteenth app to the current structure means
  editing seven hardcoded places.
