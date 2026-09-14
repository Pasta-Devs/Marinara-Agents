# Slurp Audience Simulation Plan

Make the Slurp 2 audience simulation believable, fast, and fully tunable by users — including
user-defined fan types — while keeping every model call deliberate and budgeted.

Target: **slurp2 0.0.10**, one version bump, delivered in slices (one commit per slice).

This is a handoff artifact. A fresh agent should be able to pick up any slice from here.

## Status

| Slice | What | State |
| ----- | ---- | ----- |
| 1 | Simulation Tuning object, presets, rules read values from Tuning | done |
| 2 | Simulation bug fixes (follow type, subs every tick, ambient pay, like budget, trickle, conversion growth) | done |
| 3 | Free clock: server timer, lock, catch-up cap | done |
| 4 | Simulation settings UI + live estimate | not started |
| 5 | Fan Types: model, built-ins, migration, voice in prompts | not started |
| 6 | Per-type reaction banks, batched bank growth, rebalance population | not started |
| 7 | Fan Types editor UI | not started |
| 8 | Model Worker: job queue, budget ledger, modes | not started |
| 9 | AI Budget UI, Prompts UI, Import/Export | not started |
| 10 | Version bump 0.0.10, CHANGELOG, rebuild package + catalog, validation | not started |

## Why

A user shipped `slurp2-tune.py`, a regex patcher for the minified installed `server.mjs` that
rewrote reach, world-event rates, subscription budgets/conversion, spend-tier weights, tone text,
reply length, and schedule prompts, and then re-hashed `installed.json`. It did not deliver what
they wanted, and nobody should have to patch a bundle to tune a simulation.

Findings from tracing the source (`packages/slurp2/src/engine/packages/server/src/services/slurp`):

- **Subscriptions barely happen by design.** Default price 12; 62% of members are spend tier
  `none` (budget 0); affordable followers convert at 2–12% per day, rolled once per UTC day, and
  the roll only runs on the maintenance cadence (`CHURN_MIN_ELAPSED_DAYS = 0.5`). Ambient accounts
  in `audience` are not population members, so the subscription loop skips them.
- **Likes stall.** The pulse is capped at 6 actions per tick, 3 minutes per reaction at reference
  reach 3000, posts ≤ 48h, a pool of 24 awake members, one like per actor per post.
- **Follows can silently fail.** `applyPulse` records a follow as a `"like"` interaction. If that
  actor already liked the post, nothing is created and the tie never reaches `follower`.
- **Reach / rate edits don't touch follows or subs.** They only feed commission/DM/question
  chances in `slurp-world.ts`.
- **Fan archetypes are labels.** The six Engine archetypes only weight actor selection. The
  prompt never describes them; spend tier, traits, active hour, and funnel odds live elsewhere as
  constants.

## Principles

1. **Numbers are free, readable text costs.** State changes run constantly. The model only writes
   text somebody will read.
2. **Bank first, model second.** Every text has a free version. The model upgrades it when it
   matters and the budget allows.
3. **Deterministic.** Same seed and time → same world. No jitter between reloads.
4. **Everything tunable.** No hidden constants in rules; values come from Tuning or a Fan Type.
5. **Guardrails.** zod min/max on every value, plus hard code ceilings on events per tick and
   model calls that no setting can exceed.

## Architecture

```
Config (Tuning · Fan Types · Model Budget)
   │ read
Rules (pure, no DB) ◄── Banks (shipped + grown, per fan type)
   │ plans                    ▲ fills
Free Clock (tick) ──jobs──► Model Worker (queue · priority · budget · mode)
```

- **Rules**: existing pure modules (`slurp-reach`, `slurp-world-pulse`, `slurp-world`,
  `slurp-audience-subscription`, `slurp-population`, …) take their numbers as input.
- **Free Clock**: `slurp-world.operation.ts`, split into ordered steps.
- **Model Worker**: `slurp-pending-text` generalized into a job queue.

## Tiers

| Tier | Content | Cost | Clock |
| ---- | ------- | ---- | ----- |
| 0 Numbers | reach, counts, funnel, subs, churn, arcs, income, mood | free | every tick |
| 1 Bank text | pulse comments, request templates, creator replies | free | every tick |
| 2 Rewrite | placeholder → specific text when read | model | worker |
| 3 Generation | comment threads, DM replies, briefs, arcs, schedules | model | worker |
| Bank growth | one batched call fills all low per-type banks | model, rare | worker |

## Data model

### SimulationTuning (Slurp settings)

```ts
SimulationTuning {
  preset: "quiet" | "realistic" | "lively" | "generous" | "custom"
  clock:   { tickMinutes; backgroundTimer; catchUpHours; maxEventsPerTick }
  reach:   { floor; ceiling; growthDays; realFollowerWeight }
  pulse:   { minutesPerReaction; referenceReach; maxPerTick; likeBudgetScale; postMaxAgeHours; oldPostTrickle; poolSize }
  world:   { maxActionsPerTick; maxOpenRequests;
             commission: { floor; cap; curve }; message: {…}; question: {…};
             questionNeedsRecentPost }
  funnel:  { rollCadence: "daily" | "hourly"; churnDays; ambientCanPay; conversionGrowth }
  economy: { audienceCommissionPrice }
  prompts: { tones: { warm; mixed; unfiltered }; fanActivityExtra; replyMaxChars; scheduleExtra }
}
```

`realistic` equals today's constants (plus bug fixes). Editing any value flips preset to `custom`.

### FanType (Slurp settings, list)

```ts
FanType {
  id; name; builtIn; enabled
  share                                   // population weight
  engineArchetype                         // nearest Engine NoodlerFanArchetype, for the Engine interface
  voice                                   // prompt text, ≤ ~600 chars
  traits: string[]
  activeHours: { peak: 0-23; spread: 1-12 }
  behavior: { activity; like; follow; comment; question; dm; commission; tip; unlock }
  spend: { weeklyBudget: [min, max]; commissionBudget: [min, max]; tipChance }
  funnel: { followChance; subConversionPerDay; loyaltyDays; renewChance }
  tone?: "warm" | "mixed" | "unfiltered" | string
  bank: { targetSize }
}
```

Built-ins (editable, resettable):

| Engine archetype | Built-in | Sketch |
| ---------------- | -------- | ------ |
| ordinary | Regular | medium activity, light spender |
| eccentric | Night Owl | late peak, odd voice |
| crossFandom | Crossover Fan | comments, rarely pays |
| raider | Troll | blunt voice, no spend |
| organicDiscovery | Newcomer | high follow chance, low loyalty |
| freeResource | Lurker | likes only, never pays |
| ordinary | Superfan | converts, tips, long comments |
| ordinary | Whale | rare, big budget, commissions |

### ModelBudget (Slurp settings)

```ts
ModelBudget {
  mode: "off" | "present" | "background"
  connectionId: string | null
  callsPerHour; callsPerDay
  jobs: { [kind]: { enabled; priority; maxPerDay } }
}
```

### Table changes

| Table | Change |
| ----- | ------ |
| `slurpPopulation` | add `fanTypeId`; `weeklyBudget` numeric (from `spendTier` range) |
| `slurpAudienceTies` | add `followedAt` |
| interactions | follows get their own interaction type |
| `slurpPendingText` | generalized to model jobs (kind, subject, priority, status, attempts, expiresAt) |
| reaction bank | keyed by `fanTypeId` |
| new budget ledger | calls per hour/day, survives restarts |

## Free Clock

Triggers: Slurp read (as today) and a server timer every `tickMinutes` when `backgroundTimer`.
Shared lock + mark, so ticks never overlap or double-apply.

Steps per tick (pure plan → write):

1. Time: elapsed since mark, capped at `catchUpHours`.
2. Presence: who is awake (fan type `activeHours`).
3. Pulse: likes / follows / bank comments / views / unlocks. Like budget scales with reach,
   separate from the follow+comment cap. Older posts get a small decaying trickle.
4. Funnel: advance ties; follow chance from fan type.
5. Money: subscribe / renew / lapse (daily or hourly key), tips, income. Runs every tick.
   Conversion grows with interactions and time since `followedAt`.
6. World events: decide commissions / DMs / questions; bank text now; enqueue rewrite jobs.
7. Relationships: churn, audience arcs, rapport (maintenance cadence).
8. Creators: mood, modifiers, bank replies to comments.
9. Events: notifications, capped.
10. Jobs: enqueue model jobs for new visible text.

No step calls the model.

## Model Worker

| Priority | Job | Trigger |
| -------- | --- | ------- |
| 1 | `dm_reply` | player messaged a fan |
| 2 | `rewrite` | placeholder item opened/visible |
| 3 | `thread` | post published |
| 4 | `brief` | commission request open |
| 5 | `bank_grow` | a type's bank below target or repeating (one batched call for all low types) |
| 6 | `arc` / `schedule` | weekly |
| 7 | `fan_type_voice` | user clicks "Draft voice" |

Modes: `off` (banks only), `present` (default; worker runs while a Slurp client is active),
`background` (opt-in; timer also drains priorities 3–6).

Claim a job only when the ledger has hour and day headroom. Stale jobs expire. Failed jobs keep
their bank text — nothing ever renders blank.

## Fan Types behavior

- Custom types map to an Engine archetype, so the Engine interface is unchanged.
- Deleting a type moves members to a chosen fallback type.
- Changing shares affects new members only; "Rebalance population" reassigns after a preview.
- Fan-activity, rewrite, and DM prompts receive each actor's `voice` + traits + tie.

## UI

New components, not more lines in `SlurpSettings.tsx` (already ~5k lines):

```
Settings → Audience
  Overview    preset picker · live estimate · import/export
  Fan Types   list with share bar → editor (voice, traits, behavior, spend, funnel, bank preview)
  Simulation  clock · reach · pulse · world · funnel · economy (Advanced toggle)
  AI Budget   mode · connection · limits · per-job toggles · usage today
  Prompts     tones · extra instructions · reply length · schedule additions
```

Live estimate runs the same pure rules client-side over 7 simulated days for a sample creator:
followers, subs, income, likes, requests, model calls per day. A test asserts estimate and tick
share the same rule functions.

Import/Export: `{ version, tuning, fanTypes, budget }` JSON, validated and clamped by zod.

## Migration

- Missing `tuning` → Realistic preset.
- Members without `fanTypeId` → built-in mapped from `archetype`; `spendTier` → budget in range.
- Existing follow-as-like rows stay; new follows use the new type.
- `slurpPendingText` rows → `rewrite` jobs.

## Decisions

- One version bump: slurp2 → **0.0.10** (patch bumps only for Agents packages).
- No per-creator tuning overrides for now.
- Existing members keep their type on upgrade.
- Free tick also runs on a server timer.
- Background model mode exists as opt-in.
- Bank growth is one batched call covering all low fan types.

## Validation

- Pure regression tests per rule with Tuning inputs, determinism, catch-up cap, budget ledger,
  fan type deletion fallback, follow-after-like.
- Re-derive the pre-existing slurp test failure baseline before comparing.
- `npm run check`, catalog/locale/release-notes validators, rebuild slurp2 package and catalog.

## Baseline (pre-existing failures)

Derived on `origin/staging` (8924a8c8) before slice 1, running each test with `npx tsx`.

- `tests/slurp2-*.regression.ts` (21 files): 3 fail — `slurp2-branding`, `slurp2-bughunt`,
  `slurp2-restore-settings-follow`.
- `tests/slurp-*.regression.ts` (85 files): 12 fail — `slurp-alive`, `slurp-feed-layout`,
  `slurp-identity`, `slurp-lifecycle-safety`, `slurp-onboarding-failure-reasons`,
  `slurp-payment-clarity`, `slurp-phase1-durability`, `slurp-population`, `slurp-ppv-paywall`,
  `slurp-relationship-panel`, `slurp-stance`, `slurp-studio`.
- `node scripts/typecheck-packages.mjs slurp2`: no undefined names (clean).

## Slice 2 notes (for later slices)

- Follows still write a `"like"` row; the tie advances even when that row exists
  (`slurpPulseTieAdvance`). A distinct follow interaction type was skipped: the Engine interaction
  schema and like counts would need it too. Revisit with Fan Types if follows must be listable per post.
- `slurpAudienceTies.followedAt` added (file table, nullable; old rows read null = 0 days following).
  It is set once when a tie first reaches follower and is not cleared on lapse.
- Subscriptions run every tick: full tie scan with a per-tick member cache (`ponytail:` in
  `slurp-world.operation.ts`). Slice 3 (server timer) multiplies this cost; add a batch member getter
  or a due-date filter if ticks get slow.
- Ambient accounts pay on the spend tier their id would generate when `ambientCanPay`; slice 5 should
  map them onto a Fan Type instead.
- `pulse.likeBudgetScale`: 1 = shared plan exactly; <1 drops a share of likes; >1 adds reach-scaled
  likes bounded only by `SLURP_TUNING_PULSE_PER_TICK_CEILING`. Slice 4 live estimate should call
  `planSlurpWorldPulse` directly.
- `clock.catchUpHours` now drives `slurpWorldElapsedDays` (72h = old 3 days). `tickMinutes`,
  `backgroundTimer` and `maxEventsPerTick` are still unread (slice 3).

## Slice 3 notes (for later slices)

- The timer is the existing `slurp-world-scheduler.service.ts` (already started/stopped via
  `addTeardown` in `server-entry.ts`). It wakes every `clock.tickMinutes`, re-reads settings each
  wake, and ticks when `slurpWorldTimerDue` says so: every wake with `backgroundTimer`, else the old
  6h cadence (`SLURP_WORLD_IDLE_POLL_MS`). Slice 8's background worker mode can hang off this wake.
- Lock: no new guard. `tryNoodleOperation("slurp-world-tick")` already refuses overlapping ticks
  (`busy`) for the read catch-up and the timer. In-process only (`ponytail:` note for a DB lease).
- `clock.maxEventsPerTick` caps `recordCreatorEvent` through `slurpCapTickEvents` (tick storage,
  including arc events written inside storage). Commission/message events written by the messages
  storage are not counted; they are bounded by `world.maxActionsPerTick`.
- Subscription scan skips the member read for ties that cannot decide (paid through the future, or
  unpaid and not `follower`). Still a full tie scan; batch getter deferred.
