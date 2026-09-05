# Slurp Live World Plan

Make Slurp feel like a platform with a real audience instead of a demo with twelve accounts.

This document is a handoff artifact. It records the finding, the design, every decision **and its
reason**, the staging, and the build commands, so a fresh agent can continue without re-deriving
any of it.

**Read "Rejected approaches" and "What the first pass got wrong" before proposing anything.** The
first version of this plan was wrong in ways that are not obvious.

## Status

| Stage | What | State |
| ----- | ---- | ----- |
| 0 | Separate creator earnings from spending money | **done** |
| 1 | Creator home: legibility, goals, catch-up | **done** |
| 2 | Notification stream | **done** |
| 3 | Audience-initiated commissions and questions | **done** |
| 4 | Audience population and funnel | **done** |
| 5 | Reach derived from funnel state | **done** |
| 6 | Tiered comments, deferred generation queue, event-driven DMs | **next** |
| 7 | Fan cards, reactions, cast arcs, tone dial, world rhythm | not started |

Re-ordered after a review pass. The original order built a simulation with no goals, no visible
cause and effect, and nothing that asked anything of the player. See "Review findings".

`slurp-reach.ts` and its wiring exist from an earlier pass. See "What survives" for what to keep.

## The product

Slurp simulates an OnlyFans-style platform inside Marinara Engine. Nothing is real.

The player holds several **personas**. Each persona is a different character they play, with its
own wallet, subscriptions, direct-message threads, and rapport. A session moves between seats:
post as her, answer her messages, then switch and consume as him. **No seat may be favoured.**

There are two kinds of creator, and the difference is load-bearing:

| | Persona-backed | Character-backed |
| --- | --- | --- |
| `sourceKind` | `"persona"` | `"character"` |
| `creatorBelongsToViewer` | true for the owning persona | never true |
| Role | **You operate it.** Post as it, answer its messages, hold its earnings. | **Autonomous NPC.** It posts on its own. You follow and subscribe as a fan. |

Character-backed creators are the closest thing to other people on the platform, and they already
exist in the schema and the auto-post scheduler. They are what gives the fan seat content the
player did not write.

## The circuit

This is the whole product in one loop:

```
you post as your creator → the audience responds → your creator earns
        ↑                                                    ↓
  you subscribe to NPC creators ← you withdraw to spending money
```

Every stage below serves some part of that circuit. If a proposed feature does not, question it.

## The core constraint: the world is an audience

The background cast are **fans and lurkers with no creator profiles of their own**.

This is a maintainer decision and it is load-bearing. A creator needs an avatar and post images.
Generating those is slow and expensive and has no cheap tier. An audience needs none of it.

What the audience does: like, comment, follow, unfollow, subscribe, lapse, tip, unlock locked
posts, and occasionally send a direct message to one of the player's creators.

What the audience must never need: a profile page, a post grid, generated images, or content of
its own.

So the fantasy is narrower and better than "a big platform": **people are watching, and what I do
changes how they respond.**

## The engine: a funnel, not a crowd

A flat crowd of likers is noise. An audience is a funnel, and the life is in the **movement**:

```
stranger → viewer → liker → follower → subscriber → regular → whale
                  ↖ lapsed ← ─────────────────────────────────┘
```

Every transition is one row change. Every transition is free. Every transition is a sentence the
player can read.

This replaces an invented follower number. A follower count is **the number of people in follower
state**, plus a multiplier for the mass never materialised. Decay is not a curve on a number;
decay is people leaving the funnel because the creator went quiet.

Post performance drives the movement. A post reaches some people. A fraction like it. A fraction
of those follow. A fraction of those subscribe. Properties the player controls shift the
fractions: image or no image, locked or public, hour posted, gap since the last post.

That is the feedback loop. The first version of this plan had none.

## Aliveness is an event stream, not numbers

A number with no event behind it is static. What reads as alive is a readable sequence:

- "Moth Hour subscribed."
- "You passed 5,000 followers."
- "Someone unlocked the locked post."
- "Brine Index has not opened your posts in three weeks."

Those cost nothing. They fall out of the transitions above.

**Slurp has no notification surface.** Only `unseen-count` for new feed posts and unread counts on
direct messages. Nothing reports a subscriber, a tip, an unlock, a milestone, or a loss. The world
can be made as alive as you like; without this surface the player sees none of it.

That is why Stage 1 is notifications and not population.

## Decisions and their reasons

Each of these was decided with the maintainer. Do not reverse one without asking.

### Time: background ticks plus catch-up on open

A few ticks a day advance the world, and opening Slurp advances it to now.

Implement as **one `advanceWorld(since, until)` function with two callers** — the scheduler and the
on-open path. This is the same shape as `applyStipend`, which bills on read and needs no timer.
Never write the logic twice.

### Unattended work is free-tier only, except posting

A background tick may move the funnel, add likes, follows, subscriptions, lapses, and template
comments. All free. Anything needing the model is **queued**, not generated, so the player never
pays for text nobody read.

**Auto-posting is the deliberate exception.** Creator posts keep generating in the background,
because posts are the content everything else reacts to; the world needs them to exist before the
player arrives. This already works — see `slurp-autopost-scheduler.service.ts` and
`slurp-reserve.operation.ts`.

### Queued model work is written top-few-first, then lazily

On open, write the few most notable queued items immediately so the catch-up panel is complete.
Everything below is written when it scrolls into view, and never if the player scrolls past.

### Volume: a readable handful

Ten to twenty notable events a day, across all creators. Every one worth reading.

This requires **significance scoring**, not a firehose. Small events group ("14 people liked
this"). Trivial ones never surface. A notification list that cannot be cleared is a chore.

### Creator earnings are separate from spending money

`creditCreatorIncome` in `slurp.storage.ts` currently does this:

```
recipientId = creator.sourceKind === "persona" ? creator.sourceEntityId : creator.id
```

A creator backed by a persona pays income into **that persona's own spending wallet** — the same
balance the player spends as a fan.

The stipend floor is 60 coins a day. An unlock costs 3. If 340 audience members subscribe at 12
coins a week, that is 4,080 coins a week landing in spending money. No purchase is a choice after
that.

Two balances are needed because they want opposite properties. Spending money must be **scarce**
or choices do not matter. Earnings must be **large and growing** or success is not felt. One
number cannot do both.

This also repairs an existing defect. When the player owns the creator, payment returns to the
payer. Tipping your own creator nets zero and writes two ledger lines; there is no ownership guard
on `POST /noodler/accounts/:id/tip`. Across the household money never leaves the system, and the
stipend keeps adding, so scarcity already erodes.

- **Stage 0:** earnings get their own balance and ledger, display only. Audience income is then
  safe to add.
- **Later:** a manual payout moves earnings into spending money, rate-limited by a curve on
  creator size and capped near a few multiples of the daily stipend. Earnings stay uncapped
  because that is the score. **The payout is what closes the circuit** — a creator who does well
  funds subscribing to NPC creators.

### Followers can be lost

Slow, and floored so a creator never drops to nothing.

A number that cannot fall has no stakes, so raising it means nothing. What breaks the illusion is
*jitter* — a value that differs between two reads of the same page. Decline the player earned is
correct.

### Tone: full range, behind a dial

Critics, blunt comments, and people who unsubscribe loudly are allowed. A Settings dial controls
it.

Open question for the maintainer: the dial's **default**. Shipping "full range" by default may
ambush a player who wanted a relaxed session. Recommend defaulting to the middle level and letting
the dial reach full. One word from the maintainer settles it.

### Comments: a few real, many generic

Two or three model-written comments per post that reference the real content. The rest come from a
template bank and stay vague enough to fit anything. The specific ones carry the believability;
the generic ones carry the volume.

### The cast has arcs

Named regulars follow trajectories: lurker becomes regular, becomes whale, burns out, goes quiet,
sometimes returns. This costs almost nothing — it is state transitions — but it needs a small
designed vocabulary of arcs rather than ad-hoc rules.

## Review findings

A review pass against "living, breathing, fun to play, fun to watch, fun to interact with, and
sensible to grasp" found the plan failing three of those. Recorded because the fixes reshaped the
stage order.

**The plan built a simulation, not a game.** Systems with no goals. Causality with no way to see
it. Events that never ask anything of the player.

1. **No goals.** Nothing to aim at. Missing: follower milestones, and **tip goals**
   ("340 / 500 to unlock the next set"). A tip goal gives the audience a reason to tip and the
   player a reason to care. Core to the genre, absent from the code and from the first plan.
2. **Causality was invisible.** The plan said image, locked, hour, and gap shift the outcome. There
   is no analytics surface anywhere in Slurp — no dashboard, no per-post stats. Hidden levers mean
   the player is not playing; they are watching a random number generator. This made the careful
   causality worth no more than the hash model it replaced.
3. **The world never asked for anything.** Everything was the world *acting*. Nothing required a
   response. A world that never needs you is a screensaver. Interaction needs obligations: an
   unanswered message, a pending commission, a question in a comment.
4. **Commissions were orphaned.** `createCommission` takes `viewer.id`, so only a player persona
   can request one. The audience cannot. It is the best mechanic already in the codebase and it was
   unused — the world initiating, a multi-step exchange, a clear price negotiation, and a natural
   Tier-2 moment.
5. **No reactions.** Slurp has only like, reply, and repost. Emoji reactions are Tier 0, unlimited
   volume, and give a post texture rather than one number.
6. **A name told the player nothing.** Recognisable regulars need a fan card — *subscriber 3
   months · 12 unlocks · replies at night*. That card is the entire payoff of the funnel.
7. **No cold start.** A new install has no creators, no posts, no audience. The first session is
   where people decide whether to continue, and it was empty.
8. **Seat clarity.** Creator and fan in one session is inherently confusing, and nothing made the
   current seat obvious. Open question — may already be handled by the persona switcher in practice.
9. **Surface sprawl.** Feed, profile, messages, wallet, settings, notifications, catch-up,
   dashboard, fan cards, analytics is too many places inside a package that lives inside another app.

**The consolidating fix:** one **creator home** answering "how am I doing" — earnings, followers
with the change since last visit, recent posts and what each brought, top fans, active goals. It
absorbs analytics, milestones, and the catch-up panel instead of adding three more destinations.
That is findings 1, 2, and 9 together.

### New design rule

**Legibility.** If the player cannot see why something happened, the mechanism does not count as
built. Causality that is not surfaced is indistinguishable from randomness.

## Design rules

- **The player can only know about thirty people.** Materialise a small named cast at the top of
  the funnel; keep everything below as aggregate numbers. Bounds cost and reads better than a
  thousand names.
- **The player must be allowed to fail.** Reach follows a power law. Most posts do almost nothing.
  A rare one goes far. Without failures a success means nothing.
- **Churn is the cure for repetition.** If the same thirty regulars answer everything, the current
  problem returns with thirty faces instead of six.
- **World-originated direct messages are triggered by events, never by a timer.** A fan writes
  because they just subscribed, because a post went far, or because they are about to lapse.
  Timer-driven messages read as noise.
- **The first ten seconds of a session are the product.** Open Slurp, see what happened. That
  space is empty today.
- **The trickle must be visible.** Likes must arrive while the player watches. A curve tuned in
  days shows nothing inside a twenty-minute session.
- **Never inflate what the economy reads.** Wallet balances, real interaction rows, and paying
  subscriber counts stay exact.
- **No seat may be favoured.** Creator, inbox, and fan all matter in one session.

## Fidelity tiers

Today every fan action goes through one model batch (`generateNoodlerFanActivityBatch`). That is
why the world is both expensive and thin: the budget buys a handful of actions, so you get a
handful. Invert it.

- **Tier 0 — free.** Counts, likes, follows, funnel transitions, notifications. No model call.
- **Tier 1 — near free.** Template comments keyed to archetype and post type. Hundreds of
  fragments produce thousands of variants.
- **Tier 2 — model.** Comments that reference real content, and world-originated direct messages.
  Named cast only, on posts the player opened.

## Stages

### Stage 0 — separate creator earnings — NEXT

Give the creator its own earnings balance and ledger. Reuse `slurp-wallet.ts`; it is the same
shape. Stop `creditCreatorIncome` writing into a persona spending wallet. Add an ownership guard
to the tip route. Display only, no payout yet.

Small, unblocks audience income, and repairs the self-payment loop. The creator home needs a real
earnings figure, so this comes first.

### Stage 1 — creator home — DONE, except tip goals

`GET /noodler/studio` plus `SlurpStudioView`, reachable from the shell nav for any persona that
operates a Creator. `slurp-milestones.ts` is pure and testable; `slurp-studio-snapshot.ts` holds
the mark deltas are measured from.

Deltas are `null` on a first visit rather than `0`, because "no change yet" and "measured no
change" are different and render differently. Reading the studio rewrites the snapshot, so the
client hook uses `staleTime: Infinity` — a refetch would silently zero the deltas the player is
looking at.

Per-post **earnings** attribution is deliberately absent. The ledger carries no post id, and
`unlockCount` is synthetic reach, so a money figure derived from it would contradict the real
earnings balance. Add it when Stage 4 makes unlocks real.

**Tip goals** landed in `slurp-goal.ts` with `PUT /noodler/accounts/:id/goal` and an editor on the
Creator home. Progress is measured from lifetime earnings at the moment the goal opened, never
from the balance: a balance falls when money is withdrawn, and a goal that slid backwards because
the Creator was paid would be nonsense.

Still open: the goal is not yet shown on the Creator's public profile, which is where it would
actually give a fan a reason to tip. The studio carries it; the profile does not.

### Stage 1 (original scope)

One surface answering "how am I doing", per operated creator:

- Earnings, and the change since the last visit.
- Followers, and the change since the last visit.
- Recent posts with what each brought: reach, likes, new followers, unlocks, earnings.
- Top fans.
- Active goals: follower milestones and tip goals.

This is the legibility fix. Everything the world does becomes visible and attributable here.

Buildable on data that already exists: the wallet ledger, subscriptions, real interaction rows,
and `slurp-reach.ts`. Top fans stay thin until Stage 4 and that is acceptable.

### Stage 2 — notification stream — DONE

`slurp_events` table, `slurp-events.storage.ts`, `GET /noodler/notifications`,
`POST /noodler/notifications/seen`, and `SlurpNotificationsView` with a badge in the shell nav.

Emitters are wired into the paths that already existed: subscribe, renew, unsubscribe, tip,
unlock, PPV unlock, message-request fee, commission requested, commission accepted, and a fan
sending a direct message.

`notifyCreatorIncome` is separate from `creditCreatorIncome` on purpose — the latter returns early
when the wallet is off or the revenue share is zero, and a Creator with the economy disabled should
still be told somebody subscribed. A notification failure is caught and logged; it must never roll
back the action that caused it.

`slurp-event-weight.ts` holds the significance scoring, and it is where the readable-handful rule
actually lives. Two things it got wrong first, both now pinned by regressions:

- `Math.max(0, NaN)` is `NaN`, so one bad amount produced a `NaN` weight that would sort
  unpredictably for the life of the row.
- The first money curve, `log2(1 + coins) * 6`, gave a 3-coin unlock a +12 boost and pushed every
  routine unlock over the notable line — the exact flood the rule exists to prevent. Dividing by a
  reference before the log fixed it: 3 coins adds ~3, 500 adds ~45.

Actor ids are resolved to display names at read time. Storing ids keeps a renamed or departed
account renderable; resolving late is what stops the feed saying "abc-123 subscribed".

Still open: `comment`, `milestone`, and `followers` kinds are defined and weighted but nothing
emits them yet. Milestones are computed in the studio and should be recorded there.

### Stage 2 (original scope)

A Slurp-owned event table scoped by **recipient persona id**. Only persona-backed creators have an
owner, so only they produce creator-side notifications; fan-side events go to the persona too.

Build against events that already exist — subscriptions, tips, unlocks, replies, messages. Every
notification must navigate to the thing it describes.

Include significance scoring and grouping from the start, or the readable-handful rule is lost.

### Stage 3 — audience-initiated commissions and questions — DONE

`advanceSlurpWorld` is the `advanceWorld(since, until)` the plan asked for: one function, two
callers — `slurp-world-scheduler.service.ts` every six hours, and the notifications read on open.
Advancing on read mirrors `applyStipend`, which bills on read and needs no timer.

`slurp-world.ts` holds the planner and is pure, so rates are testable without a database.
`slurp-world-copy.ts` is the Tier 1 bank: combinatorial, deterministic, free. Briefs stay vague on
purpose — a template that fakes specificity about a post it never read is worse than one that does
not try. Specificity is Tier 2's job and Tier 2 runs when the player is present.

Ambient accounts act as the audience because they are real account rows and can therefore hold
threads. `advanceSlurpWorld` has one line selecting them; Stage 4 changes only that line.

Rates, measured: a 2,500-follower Creator sees about 6 commissions and 12 questions over 30 days.
The rate is invariant to tick frequency, because elapsed days scale the per-day chance.

Three guards, all with regressions:

- **Elapsed time is capped** at `SLURP_WORLD_MAX_CATCHUP_DAYS`. A month away must not produce a
  month of backlog.
- **A full queue is left alone.** Asking again while three requests sit unanswered is how an
  obligation layer becomes a chore.
- **Creators are shuffled before the action ceiling is applied.** Without it the budget went to
  whichever Creators sorted first, and the rest of a large roster stayed permanently silent. A
  30-creator roster now serves all 30.

Still open: `slurp-world-copy.ts` briefs are generic. Tier 2 rewriting on open is Stage 6.

### Stage 3 (original scope)

Let the world ask for things. Reuse the commission flow exactly as built; it needs no new UI, only
a non-player initiator. Add comments that ask a question and expect an answer.

This is the obligation layer, and it is what makes the world worth returning to.

### Stage 4 — audience population and funnel — PARTLY DONE

Landed:

- `slurp-population.ts` — pure combinatorial generator. 48 × 48 × 8 handles and 2,304 display
  names, which is the number that matters: display names must clear a 30-person named cast by the
  birthday bound, and a first version with 840 collided inside one cast.
- `slurp_population` and `slurp_audience_ties` tables, with `slurp-population.storage.ts`.
  Members are written only once they act; ties carry the funnel stage, spend, and interactions.
- `populationNoodlerFanIdentityProvider` replaces the six fixed identities. Fan activity now draws
  a cast per run: `FAN_RUN_RETURNING` people who acted before, so regulars recur and can be
  recognised, plus `FAN_RUN_NEWCOMERS` new faces, so the roster churns. A frozen cast of thirty is
  the old six-account problem with thirty faces.
- Spend tiers are weighted 62/24/12/2. A crowd where everyone pays is neither believable nor
  interesting, because the few who do pay stop meaning anything.

`advanceTie` never lowers a stage. Churn owns that and has its own reasons.

Also landed:

- Subscribe, tip, unlock, and the world tick's questions all advance a tie. Without real payments
  moving the funnel it would record a fraction of what happened and could never be believed.
- Unsubscribing lapses the tie, so a lost subscriber leaves the funnel as well as the feed.
- Churn in the world tick: anyone silent for `CHURN_SILENT_DAYS` drifts out, so the named cast
  rotates rather than freezing. Subscribers are exempt — their tie ends when the subscription does.
- The named cast is surfaced in the Creator home as "Who is showing up", with stage, spend, and
  traits. A name with no history is still wallpaper.

Still open:

- The world tick draws only from ambient accounts for commissions, because a commission needs a
  thread and threads key on an account id. Population members act through snapshot paths.

### Stage 4 (original scope)

A Slurp-owned population table: handle, display name, archetype, traits, join date, active hours,
interests, spend tier, and **per-creator funnel state**. Generation is combinatorial. Zero model
cost.

Per-creator relationships belong to this stage, not a later one. They fix incoherence, and a name
with no relationship is still wallpaper.

Rows are created lazily and persisted only once the person acts where the player can see.

`NoodlerFanIdentityProvider` in `slurp-fan-identity-provider.ts` is the seam. Replacing
`syntheticNoodlerFanIdentityProvider` is a swap, not a rewrite. The six Engine-owned ambient IDs
(`AMBIENT_NOODLE_ENTITY_IDS`) stay as seed members.

### Stage 5 — reach derived from funnel state — DONE

`countFollowersForCreators` feeds the funnel into `slurpCreatorReach` as `realFollowers` at every
call site: the connection counts, the feed projection, the Creator home, and the world tick. A
regression asserts no call site hardcodes `realFollowers: 0` any more — the world tick did, which
made a large Creator draw requests as quietly as a brand-new one.

**The monotonicity rule is gone**, and the reach module now records why. It was a design error
stated as a principle: a number that cannot fall has no stakes, so raising it means nothing. What
breaks the illusion is *jitter* — a value that differs between two reads of the same page — not
decline the player earned by going quiet. The synthetic part is still stable for a fixed audience;
the total moves because the funnel moves.

Churn now runs before the follower count in the world tick, so reach reflects the audience that is
left rather than the one that just drifted out.

### Stage 5 (original scope)

Follower count becomes a count of people in follower state plus an un-materialised multiplier.
Decay comes from lapses. Post performance follows a power law shifted by post properties. The pure
reach function is demoted to a genesis layer.

### Stage 6 — tiered comments, deferred queue, event-driven DMs

Split `generateNoodlerFanActivityBatch` along the tiers. Add the deferred generation queue with
top-few-first draining. Add world-originated direct messages triggered by funnel events.

### Stage 7 — fan cards, reactions, cast arcs, tone dial, world rhythm

Fan cards on every audience name. Emoji reactions. Arc vocabulary for the named cast. Tone
setting. Cluster activity by hour; ambient bios already say "night-scroller" and nothing reads it.
Retune settle curves for session length, not calendar days. Seed a cold start so a new install is
not empty.

## Audit findings (post-1.1.5)

A review pass found the obligation layer non-functional end to end, for three compounding reasons.
All are fixed; each has a regression.

1. **No Creator-side inbox.** `/messages/threads` returned only threads where the persona was the
   *viewer*. A fan writing to your Creator — or a commission the world opened on their behalf —
   created a thread nobody could ever reach. The notification pointed at an inbox that did not
   contain the thing it named. Fixed with `listThreadsForCreators` and a "Written to your
   Creators" section; a thread the player opened with their own Creator is excluded so it cannot
   appear on both sides.
2. **The world audience was empty by default.** The tick gated its audience on
   `allowRandomUsers`, which defaults to `false`. So a fresh install produced no commissions and
   no questions, ever. That setting governs whether ambient profiles join the feed as visible
   participants; it is not a switch for whether a Creator has an audience. The tick now draws from
   the population, ungated, and adds ambient profiles when they are switched on.
3. **Population members could not act.** `applyAction` resolved actors through
   `getNoodlerAccountById`, and population members have no account row, so every population action
   was silently dropped. A `resolveActor` helper now handles both.

Two more, smaller:

4. **`population.touch()` was never called.** `listAll` orders by `lastActiveAt`, so the pool kept
   ordering by creation time: the same earliest members were redrawn forever and anybody who
   actually showed up sank out of it. "Regulars recur" did not work. Both the world tick and the
   fan-activity run now touch the cast they draw.
5. **Milestones were reported nowhere.** They were computed in the studio, rendered in the studio,
   and never written to the event stream. Now recorded.

Removed as dead: `countAtOrAbove` (superseded by `countFollowersForCreators`) and
`isNotableSlurpEvent` (never used outside its own test).

## What the first pass got wrong

Recorded so it is not repeated. The first version modelled reach as
`hash(accountId) × saturating_curve(account age)`.

1. **No cause and effect.** A creator who posts 500 times and one who never posts got identical
   followers. The number grew on a timer. That is the opposite of alive.
2. **"Monotonic" was an error stated as a principle.** Growth with no possible loss has no stakes.
   The real requirement is determinism, not monotonicity.
3. **No hits and no failures.** Spread was at most 13x from two uniform factors, so nearly every
   post landed mid-range.
4. **Wrong shape.** Reach is accumulated state, not a pure function. `slurp-wallet.ts` already had
   the right pattern and it was not reused.
5. **Wrong order.** "Nothing happens unprompted" was a reported symptom and it was scheduled last.
6. **Numbers instead of events.** The pass produced numbers and never noticed that no surface
   exists to report anything.

### Rejected approaches

- **Synthetic creators** — accounts with `sourceKind: null`. Schema-legal, and rediscovering that
  is easy, so it is recorded here. Rejected: creators need avatars and post images, and image
  generation has no cheap tier. Character-backed NPC creators fill this role instead, because
  their avatars already exist.
- **Identity disclosure as a story engine.** Rejected. Disclosure stays a prompt-safety guardrail.
- **Creator-versus-creator drama.** A separate feature. Land a believable audience first.

### What survives from `slurp-reach.ts`

- The hash, **with its murmur3 finalizer**. Plain FNV-1a barely avalanches its last byte, and
  Slurp mints ids sequentially, so without the mix every post in one batch drew nearly the same
  share and a page landed on one like count. Keep it and its regression.
- The spread and settle helpers, as a **genesis layer** giving a creator with no history a
  plausible start. Stored events take over from there.
- The call sites in `routes/slurp.routes.ts` (`projectViewerPosts`, the follower count) and the
  `unlockCount` field on the projected post view. The wiring is right; the values change.

Remove the monotonicity assertion in `tests/slurp-reach.regression.ts` when Stage 3 lands. Keep
the sequential-id spread assertion.

## Build and validation

```sh
export MARINARA_ENGINE_ROOT=/home/dev/projects/Marinara-Engine
node scripts/build-feature-packages.mjs
```

Gates before handing work on:

```sh
npm run check                                     # 0 errors; warnings are pre-existing
node scripts/test-catalog-lanes.mjs
node scripts/validate-package-locales.mjs
node scripts/validate-package-locale-keys.mjs     # catches UI strings with no locale entry
node scripts/validate-catalog.mjs
node scripts/tests/catalog-release-notes.regression.mjs
for t in tests/slurp-*.regression.ts; do npx tsx "$t" || echo "FAIL $t"; done
```

New user-facing strings go in
`packages/slurp/src/engine/packages/client/src/localization/locales/en.json`, then run
`node scripts/sync-package-locales.mjs`.

`packages/slurp/server.mjs`, `packages/slurp/client.js`, `artifacts/*.zip`, `catalog/**`, and
`sources/**` are generated. Change source and rebuild; never hand-edit them.

## Notes for the next agent

- Slurp owns 17 file tables in `db/schema/slurp.ts`. New tables need no Engine change.
- Participation gates on `kind === "random_user"` in `slurp-participant-selection.ts`, not on the
  ambient ID set. A new population participates without an Engine change.
- The connection resolver for every Slurp generation is `services/slurp/slurp-connection.ts` →
  `resolveSlurpTextConnection`. Use it; do not call `getDefaultForAgents()` directly. A regression
  asserts that.
- Auto-posting already supports per-creator image generation
  (`account.settings.scheduler.autoPosting.imagesEnabled`). NPC creator images need no new work.
- House test style: assert on source text for wiring, real assertions for pure logic. See
  `tests/slurp-reach.regression.ts` and `tests/slurp-messaging-surface.regression.ts`.
- Pure modules with no Engine imports (`slurp-wallet.ts`, `slurp-reach.ts`, `slurp-poll-backoff.ts`)
  are directly testable under `tsx`. Prefer that shape for new logic.
