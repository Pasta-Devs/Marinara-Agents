# Forum — rank 5

Status: **scrapped** — see the reversal at the bottom. The decisions below are kept only as a record
of what was dropped; build none of them.

## Findings
- You can reply but **never start a thread**.
- No boards/categories, no pagination.
- Refresh (`POST /forum/refresh`) replaces the whole thread list.
- Reply count is `posts.length - 1` — fragile.
- No new-post/unread indicator. Errors swallowed.

## Decisions

All four accepted:
- **Start your own thread** — compose a new topic as the phone owner; the cast and strangers reply to it.
- **Boards / categories** — split the flat list into topical boards.
- **Refresh appends, not replaces** — new threads join the list instead of wiping it, so threads you
  replied to survive. Fixes the destructive `setThreads(response.threads)`.
- **New-reply indicators** — mark threads with activity since you last looked.

Also: fix the fragile `posts.length - 1` reply count, and surface errors instead of swallowing them.

---

## Reversal — cut the app (tester thread, [`20-tester-feedback.md`](20-tester-feedback.md))

> "Currently just an extremely basic template… but what's the point, it's just like Noodle but with
> randoms. I think we can scrap this." — gunterlie
>
> "With [Messages and Mail] in the pipeline I'm not sure what Forum serves. Noodle-we-have-at-home."
> — dsbwizzard

**Decided: remove Forum.** It duplicates Noodle with a worse feed. The one thing it offered that Noodle
doesn't — being contacted by strangers — was examined and rejected: making it work needs forum DMs,
which is a second messaging system, and Mail already accepts free-text addresses from anyone while
Messages is getting Engine-conversation threads. Both cover the stranger case better.

**The screenshot is the argument.** gunterlie's Forum capture shows five generated threads — *"Is it
just me or is Donkey getting worse?"*, *"In defense of Donkey (hear me out)"*, *"Meetup: cheese tasting
Saturday"* — each with a handle (`@mirabell03`, `@gareththe.grey`, `@fern.barrow`) and **every single
one at `0 replies`**. A forum where nothing has replies is a feed with worse chrome, and the four
decisions above were an attempt to fix that by building a second social network.

Two further details from the screenshots that make the cut cheaper than it looks:

- **Forum already renders as a website** — the capture shows it inside browser chrome at `board.web`,
  back/reload/close, not as a native app surface. And Goodle already has a **forum page kind**
  ([`13-goodle.md`](13-goodle.md)). So the *flavour* survives the cut for free: `board.web` stays
  reachable as a generated Goodle page. Only the home-screen app, its route and its schema go.
- **Forum is already second-class in Settings** — the phone's own Generation section describes
  `Feeds & sites` as covering *"Goodle, Noodle, NoodleR, Mail, and Tindler"*. Forum isn't in the list.

Consequences: drop the app and its `POST /forum/refresh` route, drop the forum content schema, and
remove the "not Forum" carve-out from the notification list in [`00-platform.md`](00-platform.md) §4 —
there's no app left to carve out. This also deletes one of the fourteen apps the device-shell registry
work in [`18-device-shell.md`](18-device-shell.md) has to carry.
