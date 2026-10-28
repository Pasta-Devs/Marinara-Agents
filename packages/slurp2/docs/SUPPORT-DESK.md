# Slurp Support Desk (design)

Status: built in 0.3.5 (2026-09-29, `stir-buildout`). Where the build differs from the design it says
so under "As built" at the end.

Slurp Support is Slurp's own staff: a faceless team, always named "Slurp Support". It is two things
at once, and both must feel like one desk:

1. **The onboarding host.** It runs the Creator sign-up scene (`SLP_SCENE_PRESETS.support`: name →
   about → look → voice → limits → review, then the approval stamp) and the player's own join
   (site welcome, roles swapped). Voice: funny but a little formal, dry jokes about paperwork.
2. **The platform's hand.** After sign-up, the player writes as Support to any Creator they do not
   run, and uses it to steer, reward, pressure and manipulate them. This is a game: the player is
   the platform.

Today Support reuses the fan chat: rapport, mood, strikes, cooling off, "subscribed", paid DM fees
and the picture verdict are computed for it, and the Details panel shows comfort, desire, respect
and pictures. A Creator's answer can carry a `staff` object that becomes Stir cards (steer + one
idea + a world wish). That is the whole toolset. This design replaces the fan parts and adds a desk.

## Decisions

| Topic                        | Decision                                                                                  |
| ---------------------------- | ----------------------------------------------------------------------------------------- |
| Where Support threads live   | A Support desk section at the bottom of the Stir tab. Persona inboxes no longer list them. |
| Support writing to *your* Creators | Stays in that Creator's inbox (it is their mail). AI Support sends notices, badges, offers. |
| Relationship                 | Trust meter per Creator. No rapport, mood tiers, strikes, pictures, fees or subscriptions. |
| Limit on the player          | Risk only. Nothing blocks a move; shady moves raise the Creator's suspicion.              |
| Getting caught               | Chance per world tick, rising with suspicion. Shown as "Risk n%". Private fallout only.   |
| Rumours                      | Player picks: told by Support (traceable, more suspicion) or planted anonymously (less).  |
| Rock-bottom Trust            | The Creator threatens to leave; a visible win-back window; then paused, never deleted.    |
| Creator tickets              | Creators may write in with a ticket (status + rating). Off by default, set in Stir settings. |
| Identity                     | Faceless team, always "Slurp Support". Old kept lines keep the host name they had.        |
| AI Support vs your Creators  | Honest by default. "Slurp plays games with my Creators too" is a Stir setting, off.       |

## Standing: Trust and suspicion

Two numbers per Creator, both visible to the player, neither shown to the Creator as a number.

**Trust** (−100…100) — how the Creator feels about the platform. Tiers: `wary`, `neutral`,
`cooperative`, `partner`. Start: `welcomed` bonus when Support signed them up (the kept sign-up chat
is the first entry of their case file), `neutral` for imported Creators.

- Rises: a play that landed (the idea became a post, the deal paid, the collab happened), a perk,
  a badge, a ticket resolved well, a kept promise.
- Falls: pushing against their `avoid` list, many asks in a short time, an undone play, a broken
  contract term on Slurp's side, a warning without cause, getting caught.
- Effect: refusals and counters get likelier as Trust falls (Stir's `refusable` flag), gossip and
  intel only come from `cooperative` and up, the Support prompt reads the tier.

**Suspicion** (0…100) — how much the Creator senses something is off. Decays slowly with time.

- Rises with shady moves: reach throttle, rumour (more when Support told it), warning without cause,
  cashing in a favour. Rises faster at low Trust.
- Each world tick rolls against it (`Risk n%` in the case file). Caught: a large Trust drop, the
  suspicion resets, and the Creator confronts Support in the thread (opens a ticket even when
  tickets are off). Never public: no posts about it, no effect on other Creators.

**Leaving.** Trust at the bottom → the Creator writes "I'm thinking about leaving Slurp" (a ticket,
even with tickets off). A win-back window (about 3 world days) shows as a countdown in the case file.
Still at the bottom when it ends → the Creator is **paused**: no posts, the page says "Left Slurp",
the world tick skips them. No data is deleted. A big offer can bring them back, at low Trust.
A Stir setting turns leaving off (then they only go quiet).

## Tools

Everything is a Stir action, so it previews, runs and undoes like the rest of Stir. Some are sent
as a message (an Offer), some are silent moves from the case file or the ✦ sheet.

Sent as an Offer (the Creator answers accept / counter / decline; accept runs it):

- Brand deal, collab, event invite, tip goal, storyline, new look (existing actions).
- Platform perks (new, Support-only): feature on Discover, badge (`Rising`, `Verified`,
  `Slurp Partner`), coin bonus.
- Challenge (new): a goal with a deadline and a reward ("3 Stories this week → a Discover feature").
  The world tick counts progress; the reward is paid or the challenge fails.
- Exclusive contract (new): perks and a better payout for terms (posts a week, themes). The world
  tick checks the terms; a broken term costs Trust on whichever side broke it.
- Cash in a favour (new): each perk earns one favour; spend it on an ask ("post about brand X").
  Raises suspicion; spending many costs Trust.

Silent (no message; from the case file or the ✦ sheet):

- Reach throttle (new): quietly lower a Creator's reach for some days. Shady.
- Rumour (new): "I heard X plans a collab with Y" becomes a memory; may spark jealousy or a rivalry
  (`start-rivalry`). Told by Support (a line in the thread) or planted anonymously. Shady.
- Trend seed (new): tell several Creators a topic is hot; some post about it.

Said in the thread:

- Platform warning (new): "your content is off-brand" → a steering change the Creator follows.
  Lowers Trust, raises compliance. Shady when there was no cause. Never touches a fan.
- Plain talk: today's `staff` answer (mood, focus, more/less, one idea, one memory, world wish) stays.

Received from the Creator:

- Intel (new): a `cooperative`+ Creator may tell Support something about another Creator. It becomes
  a card the player can act on later.

Rule kept from today: nothing Support does can name or touch a fan.

## Message kinds and chrome

New message kinds in a Support thread:

| Kind     | Who     | What                                                                         |
| -------- | ------- | ---------------------------------------------------------------------------- |
| `offer`  | Support | Holds one `SlpStirStep` + its preview; status `pending/accepted/countered/declined`. |
| `notice` | Slurp   | Milestone, trending post, payout, badge granted, challenge result. Centred system row. |
| `note`   | Support | Internal note. The player's own; never in any prompt, never seen by the Creator. |

Tickets are thread state, not a message: `{ topic, status: open | waiting | resolved, openedBy,
rating? }`.

Chrome (one look shared with the sign-up scene, so onboarding and desk read as one system):

- Header: the Creator, a "Support desk" badge, Trust tier chip, ticket status chip. Details opens the
  Support panel (Trust, risk, open ticket, pending offers, active challenges/contracts with progress,
  favours owed, recent plays and their results, the last steering change with Undo), never the fan
  relationship panel.
- Pinned ticket bar when a ticket is open: topic, status, Resolve.
- Staff side: a Slurp/headset avatar and a "Staff" label, not the persona.
- A quiet neutral console tint instead of the fan chat's pink; theme tokens only.
- The approval stamp from the sign-up marks a resolved ticket, an accepted offer, a granted badge.
- Composer: "Attach offer" and "Perk" replace tip and PPV. The composer bar's look does not change.

## Where things show

- **Stir → Support desk** (new section at the bottom): one case file per Creator — Trust, risk,
  open ticket, offers waiting, challenges/contracts with progress, favours, leave countdown. Opens
  the thread. Silent moves live here and in the ✦ sheet.
- **Persona inbox**: no Support threads. One row links to the desk.
- **Your own Creator's inbox**: the inbound Support thread (sign-up chat, then notices, badges,
  offers from AI Support). You answer as the Creator.

## Prompts

- Support reply prompt (`slp-dm-roles.ts`, `input.support`): add the Creator's attitude to the
  platform and the Trust tier; add open ticket, pending offer and active contract terms; give the
  thread its own field labels (today it says `"fan" is Slurp Support`).
- Platform attitude: derived once from the character card — `loyal`, `cynical`, `demanding`,
  `indifferent` — and stored.
- Offer answer: returns `accept | counter | decline`, a counter in plain words, a reason in voice.
- Ticket opener (world tick, when tickets are on): picks a topic from the Creator's real situation
  (an active throttle, a collab wish, money) and writes the first message. Only topics Support has a lever
  for open tickets (no badges, pushy fans or burnout), and a topic rests 14 days per Creator.
- Quick replies: saved answers in the desk composer, one tap to fill the draft. Built-ins until the
  player saves their own (`supportDesk.quickReplies`).
- Ticket close: a rating and one line; the rating moves Trust.
- Caught / leaving: the confrontation and the leave warning, in the Creator's voice.
- Notices: a template, or one short prompt in Slurp's voice.
- Rumour: makes the planted line sound natural; decides which Creators react.
- AI Support to your Creators: which notice or offer to send, and (only with the setting on) which
  shady move to try.

## Stir settings (new section in Settings)

Main view (simple controls): Creator tickets on/off (default off) and how often; platform notices
on/off per kind; Creators can refuse Support (Trust matters) on/off; shady moves on/off; leaving
on/off; "Slurp plays games with my Creators too" (default off).
Advanced: Trust and suspicion rates, risk curve, win-back window length.

## Code notes

- `slurpSupportName` and the sign-up `hostName` for Support become the constant "Slurp Support".
- Stop computing fan state for Support threads: `relationshipFor`, `resolveSlurpThreadStance`,
  strikes, cooling off, fees and subscriptions skip `isSlurpSupportThread`.
- Where Trust, suspicion, favours, challenges, contracts and the leave state are stored is decided in
  phase 1 (candidate: one per-Creator desk record next to steering; steering already keeps the
  `support` note used for Undo).
- Every new file follows `docs/architecture/README.md` and goes into `slurp2OwnedSourcePaths`.

## Phases

1. **Clean-up and standing.** Fan logic out of Support threads; Trust (and its effects on refusals);
   Support panel in Details; Support chrome shared with the sign-up scene; faceless name.
2. **Desk.** Stir → Support desk section; Support threads out of persona inboxes; Stir settings
   section.
3. **Offers and perks.** `offer` kind, offer answer prompt, Attach offer / Perk in the composer,
   perks, badges, challenges, contracts, favours; `notice` and `note` kinds.
4. **Shady moves.** Suspicion, risk roll, reach throttle, rumours, trend seeds, warnings, intel,
   getting caught.
5. **Tickets and leaving.** Ticket opener and close prompts, ticket bar, leave warning, win-back,
   pause.
6. **Your Creators.** AI Support writing to the Creators you run; the "plays games too" setting.

## As built (0.3.5)

- Offers and notes are ordinary lines with metadata (`deskOffer`, `deskNote`, `deskNotice`), not new
  stored message kinds. A note never reaches a prompt (`slurpDmTranscript` drops it).
- Intel is listed in the case file; there is no "use it" button yet (plant it as a rumour by hand).
- The desk runs at most every 30 minutes per process; the risk and ticket odds scale with the time
  since a Creator's last pass, so the pace does not change them.
- AI Support to the player's Creators sends a Stories challenge now and then, answered with Accept or
  Decline on the card; with "games" on it may throttle them quietly.
- The Inbox badge now counts unread messages only (it used to add the Activity stream).
- Polyamory (a separate request, same release): groups of up to four and polyamorous Creators in
  several couples, each Creator monogamous or polyamorous; see DECISIONS, "0.3.5 Polyamory".
- Desk notices and notes are "quiet" lines (`deskQuiet`): no reply flag, no unread, never the line
  a reply answers. Effects of a desk pass run only after its record is written.
