# Virtual Phone — App Plans

> **Implementing? Start at [IMPLEMENTATION.md](IMPLEMENTATION.md)** — the stepped execution order for
> everything in this directory, written to be handed to a coding agent cold. These files hold the
> decisions and the reasoning; that file holds the sequence, the file paths and the acceptance criteria.

One plan per app, ranked weakest first. Each file holds **Findings** (what's wrong today),
**Decisions** (what we agreed), and **Open questions** (still to answer).
Scope per app: UI/UX polish · functionality gaps · lore/AI integration.

Process: walk every app collecting decisions, then implement in one pass.

| # | Plan | Status |
|---|------|--------|
| 0 | [**Platform & cross-cutting**](00-platform.md) | **second pass — read first** |
| 1 | [Camera](01-camera.md) | decided |
| 2 | [Gallery](02-gallery.md) | partly decided |
| — | [Sharing seam (cross-app)](03-sharing-seam.md) | decided |
| 3 | [Contacts](04-contacts.md) | decided |
| 4 | [NoodleR](05-noodler-r.md) | decided |
| 5 | [Forum](06-forum.md) | **scrapped — cut the app** |
| 6 | [Tindler](07-tindler.md) | decided |
| 7 | [Mail](08-mail.md) | decided |
| 8 | [Noodle](09-noodle.md) | decided |
| 9 | [App Store](10-app-store.md) | decided |
| 10 | [Messages](11-messages.md) | decided |
| 11 | [Notes](12-notes.md) | decided |
| 12 | [Goodle](13-goodle.md) | decided |
| 13 | [Settings](14-settings.md) | decided |
| — | [**RP integration**](15-rp-integration.md) | **decided — largest item** |
| — | [**Engine interop**](16-engine-interop.md) | **third pass — changes earlier decisions** |
| 14 | [Calls](17-calls.md) | decided — new app |
| — | [**Device shell**](18-device-shell.md) | **fourth pass** |
| — | [**Background & learning**](19-background-and-learning.md) | **fifth pass — decided (minimal path)** |
| — | [**Tester feedback**](20-tester-feedback.md) | **outside review — reverses decisions in six plans** |

## Cross-cutting

See [00-platform.md](00-platform.md) — the second pass over the platform/server layers found issues
that outrank most per-app work:

1. **All generated content is truncated at 300 chars / 10 items** by a single global constant. Likely
   the root cause of thin-feeling content everywhere.
2. **~160 lines of platform architecture have no production consumer** — only tests import them.
   Capability grants are declared in every manifest and never enforced.
3. **`PhoneStore.set` does a full storage LIST before every write** — Notes' per-keystroke saving is
   two HTTP round trips per character typed.
4. Only Messages ever fires a notification, though five apps declare `notify`.
5. `hueFor` ×3, `initials` ×2, icon map duplicated.

## Bugs worth fixing regardless of design decisions

1. **Mail refresh wipes the inbox** — replaces all items, destroying read state and older mail. [`08-mail.md`](08-mail.md)
2. **Notes persists on every keystroke** — and each save is two round trips. [`12-notes.md`](12-notes.md)
3. **Contacts rows are inert** and the delete route is unreachable. [`04-contacts.md`](04-contacts.md)
5. **Lore leaks across worlds** — every lorebook feeds every phone. ~~*Deferred by decision.*~~ **Now being fixed** — phones attach their own lorebooks in Settings. [`19-background-and-learning.md`](19-background-and-learning.md)
6. **Multi-chat phones generate into `chatScope[0]`** arbitrarily. [`19-background-and-learning.md`](19-background-and-learning.md)
4. **300-char content ceiling** on everything the model generates. [`00-platform.md`](00-platform.md)

## Do before adding the Calls app

Collapse the seven-site app registration in `index.tsx` to a registry-driven lookup
([`18-device-shell.md`](18-device-shell.md)). Adding app #14 otherwise pays that cost again.

## What the tester thread changed

[`20-tester-feedback.md`](20-tester-feedback.md) — first outside read, 2026-08-07. Reversals worth
knowing before implementing anything:

- **Forum is cut**, not improved. One fewer app.
- **Lore scoping is un-deferred** and has a design: phones attach their own lorebooks in Settings.
- **The status bar is story-driven**, not drifted or read from the host device.
- **Images need a platform policy** (per-app toggles, designed no-connection state, retry on failure)
  — [`00-platform.md`](00-platform.md) §6. The fallback half is unblocked and ships first.
- **Phones bind to a persona *or* a character and persist across chats**, and each one is shaped by its
  owner. Biggest new idea in the thread — and per the tester's screenshots it needs **no new system**:
  he authored the behaviour as a lorebook entry scoped with the entry's own Characters filter. Read
  lorebooks, honour that filter, and owner-shaped phones fall out of the lore-scope work for free.
- Two new apps recorded but unscheduled: **Banking** (per-persona balance, user overrides the model)
  and **Marketplace**.

Two things from that thread that aren't tasks but should frame the implementation pass:

- **This is n=1**, from a power user who flagged his own bias four times. The reversals are solid; the
  additive asks are unvalidated until other testers weigh in.
- **The plan is almost entirely additive** — across twenty files the only subtractions are Forum, the
  dead platform scaffolding, and the faked Noodle counters, while the agent package keeps growing.
  Worth a deliberate cut pass *before* implementing, not after.

And one open question larger than the phone: there is **no "world" object in ME**. Phone, Noodle,
agents, lorebooks and LTM each scope differently, and a good half of the awkward decisions in these
files are workarounds for that absence. Engine-level, needs Mari, worth raising before the phone
accretes five more per-app workarounds. [`20-tester-feedback.md`](20-tester-feedback.md) §9.

## Task zero

**Extend the package API contract** — the concrete ask is written up in
[`21-engine-contract-ask.md`](21-engine-contract-ask.md), with the Engine file paths, current type
shapes and a minimal proposed shape for each item.

Framed as **three general mechanisms plus two data reads**, rather than the five point-solutions it
first looked like. Three of the blockers — images, calls, music transport — are really the same
thing: the phone cannot talk to another agent. `15-rp-integration.md` §5 already says the phone
should integrate *control* of other agents and never their functionality; the general ask is what
makes that possible without a new Engine change per integration.

Each general ask carries a narrow fallback that unblocks the same features, so it can be decided in
one review. Two of the four items were assumed possible when these plans were written and turned out
to be blocked once code was written against them.

The Engine contract is the remaining dependency for the blocked integrations. Package-side systemic
work continues independently: apps now feed the shared Contacts registry and money flows through a
shared wallet. Explicit Goodle discoveries, Noodle posts, and Marketplace events are also retained as
small phone-owned facts with chat provenance, so the same persona or character carries what they did
or learned into later chats without exposing private banking state.
