# Mail — rank 7

Status: **decided**.

## Findings
- **Refresh replaces the entire inbox** (`persist(response.emails.map(...))`) — destroys read state and every older mail. Worst data bug in the phone.
- No compose, no reply, no delete, no archive.
- No timestamps anywhere.
- No threading, attachments, or sender avatars.

## Decisions

**Full mail client.**
- Compose to any address, reply, delete, archive, folders.
- **Recipients: Contacts autocomplete, but free text allowed.** You can mail a known character or
  invent an address for a company/stranger and let the model decide who that is.
- Characters answer mail sent to them.
- Timestamps throughout.
- **Fix the destructive refresh first**: append + dedupe instead of replacing the inbox, so read state
  and older mail survive. This is a bug, not a feature — it lands regardless.

Needs the server to model mail addresses and threading, not just a flat list of generated strings.
This is the largest single item in the plan.

## From the tester thread ([`20-tester-feedback.md`](20-tester-feedback.md))

Current state, per gunterlie: **mail is world-scoped, with linked characters and the ability to add
your own addresses** — which matches the "Contacts autocomplete, free text allowed" decision above, so
that half is closer to done than this file implies.

The gap he named is not in the client at all:

> "There is no system for 'does this character have this character's details'." — gunterlie

Nothing models **who knows whose address**. Everyone can mail everyone. Once characters start sending
mail unprompted (`15-rp-integration.md`), that becomes visible as a continuity break — a stranger
emailing you having never been given your address. Same gap hits Messages and Calls.

Not a blocker for the mail client work here, and not being solved now. Recorded in
[`20-tester-feedback.md`](20-tester-feedback.md) §8 as the next structural gap.

Also from the thread: Mail plus Messages is the reason **Forum was cut** — between world-scoped mail
that accepts invented addresses and Engine-conversation threads, the "contacted by a stranger" case is
covered without a second forum-shaped messaging system. See [`06-forum.md`](06-forum.md).
