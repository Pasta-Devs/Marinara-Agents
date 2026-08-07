# NoodleR — rank 4

Status: **decided**.

## Findings
- Subscribing is free and **local-only** (`store: subs`); `page.price` is displayed but never charged.
- Locked posts show a bare padlock with no teaser — no reason to want them.
- You can't post as yourself; it's read-only voyeurism.
- Creator list is just the chat's phone contacts.
- Dead code: `initials()` is defined but unused (avatars replaced it).

## Decisions

- **Subscribing stays free**, but stops feeling like a no-op:
  - `price` shown as flavour, not charged.
  - Confirm step before subscribing.
  - "Subscribed since" state rather than a bare checkmark.
- No wallet/currency system — rejected as too much machinery for the payoff.

- **Blurred teaser for locked posts** — show the post blurred with the first few words legible, so
  there's a reason to want it. No extra generation: blur the text that's already there.

## Open
- Whether the user can run their own creator page.
- Creator discovery beyond the chat cast.

## Cleanup
- Delete the unused `initials()` helper.
