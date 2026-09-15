# Slurp relationship work plan (agent task file)

You are an implementation agent. Work through this file top to bottom. Each task has a goal,
the exact location, the change, and a done check. Tick the checkbox when a task is done and
verified. Do not skip the done check.

Context: Slurp is a single-user, local roleplay feature (fictional coins, AI Creators). It is not
a real payment platform. Do not add auth, tax, moderation, real-payment or age-verification work.

## 0. Rules for this run

- Repo root: the worktree that contains this file. Branch: `bye-bye-birdie`.
- Read `AGENTS.md` first. Its rules win over this file.
- Source lives in `packages/slurp/src/engine/packages/{server,client}/src`. Paths below are
  relative to that folder unless they start with `tests/`, `scripts/` or `sources/`.
- Some server files also exist in `sources/engine/packages/server/src/` (for example
  `routes/slurp-messages.routes.ts`). When you change a file, check for the copy
  (`ls sources/engine/packages/server/src/<same path>`) and apply the same change there.
- Never hand-edit generated outputs: `packages/slurp/client.js`, `packages/slurp/server.mjs`,
  `packages/slurp/manifest.json`, `artifacts/*.zip`, `catalog/**/catalog.json`.
- The worktree is dirty with an uncommitted messaging diff. Keep it. Task 0.1 builds on it.
- Line numbers were correct on 2026-09-11. Search for the quoted code if a line moved.
- Minimal diffs. Reuse existing helpers. Every non-trivial fix leaves one regression test in
  `tests/slurp-*.regression.ts`, following the style of the neighbouring tests.
- Do not commit, push or open a PR unless the operator says so.
- **STOP tasks:** tasks marked `STOP` need a product decision. Ask the operator, do not guess.
- If a task turns out to be wrong (the bug is not there, or the fix breaks something), do not
  force it. Write a short note under the task and continue.

### Commands

```sh
npx tsx tests/<name>.regression.ts          # one regression
npm run test:noodle:regressions             # all noodle/slurp regressions (stops at first failure)
npm run typecheck:packages                  # slurp typecheck
npm run check                               # prettier + eslint
node scripts/build-feature-packages.mjs slurp   # rebuild bundles, artifact, catalog
```

Known red before you start (not your fault, do not fix unless asked):
`slurp-alive`, `slurp-boundary`, `slurp-population`, `slurp-review-fixes`,
`slurp-thread-status-and-unread`. Confirm them at the start by running each one once and
recording the result. Any other failure after your change is yours.

Because the regressions script stops at the first failure, run the slurp tests in a loop that
continues:

```sh
for t in tests/slurp-*.regression.ts; do npx tsx "$t" >/dev/null 2>&1 || echo "FAIL $t"; done
```

### End of each phase

1. Run the slurp test loop, `npm run typecheck:packages`, `npm run check`.
2. Run `node scripts/build-feature-packages.mjs slurp`. Do not bump the version.
3. Add a short "Phase N result" note at the bottom of this file: what changed, test results,
   anything skipped.

---

## Phase 0 — Fix the uncommitted presence diff (do first)

### [x] 0.1 Hybrid presence rule (bug B1)

Problem: the uncommitted diff removed the `extendedOnlineUntil` override from the reply path,
but `slurp-message.operation.ts:~334-342` still writes `extendedOnlineUntil`, and
`routes/slurp-messages.routes.ts:~193-199` still reports `{ online: true, activity: "chatting" }`
from it. Result: the UI says "chatting" while the reply gets offline pacing.

Rule to implement: an active conversation window keeps the Creator online. Hot momentum alone
never wakes an offline Creator.

Change in `server/src/services/slurp/slurp-message.operation.ts`:

```ts
// ~line 78: replace the `const availability = ...`
const scheduled = source
  ? await resolveSlurpCreatorAvailability(createCharactersStorage(db), source, undefined, new Date(), undefined)
  : { online: true, activity: null, minutesUntilOnline: 0 };
// An open conversation window keeps the Creator online; momentum alone never wakes her.
const availability =
  thread.extendedOnlineUntil && thread.extendedOnlineUntil > new Date().toISOString()
    ? { online: true, activity: "chatting", minutesUntilOnline: 0 }
    : scheduled;
```

```ts
// ~line 335: only an online Creator can open or extend the window
if (momentumAnalysis.momentum === "hot" && availability.online) {
```

- Rewrite the comment at ~line 97 to describe this rule.
- Leave `slurpReplyPacing` in `slurp-messaging.ts` as the diff has it.
- `tests/slurp-chat-presence.regression.ts:~20-30` has a `doesNotMatch` on the old
  `availability = { online: true, activity: "chatting", ...` literal. Replace it with an assertion
  that the source contains `momentum === "hot" && availability.online`.
- Keep the `offlineHot` case in `tests/slurp-messaging.regression.ts:~163-172` passing.

Done when: both tests pass; the route and the reply path read the same window.

### [x] 0.2 Dead ternary (B13)

`slurp-message.operation.ts:~114`: `readTalkativenessProfile(source?.kind === "character" ? {} : {})`.
Replace with `readTalkativenessProfile({})`.

---

## Phase 1 — Money and state correctness

### [x] 1.1 Paid message request fee can be lost (B6)

`server/src/services/storage/slurp-messages.storage.ts:~394-397` (`openThread`): `spendCoins`
runs, then `creditCreatorIncome` and `notifyCreatorIncome` run outside any try block. If either
throws, the viewer has paid and no thread exists.

Fix: wrap everything after the successful debit (credit, notify, thread insert) so a failure
refunds the fee. Reuse the refund pattern at `~427-430` (duplicate-insert race).

Test: regression that makes the credit step throw and asserts the viewer wallet is unchanged.

### [x] 1.2 Stranded paid commission (B5)

`declineCommissionUnlocked` (`slurp-messages.storage.ts:~1121`) only allows `brief` and `quoted`.
A persona Creator's `accepted` commission has no `deliverAt` (`~1165-1170`), so if nobody
delivers it the coins are kept forever.

Fix: let the **viewer** cancel an `accepted`, undelivered commission when `deliverAt` is null or
in the past. Refund the paid amount. Reuse the refund code from failed delivery (`~1204-1222`).
Update the route (`routes/slurp-messages.routes.ts:~825`) and the client button in
`client/src/components/slurp/SlurpMessages.tsx` near the commission card.

Test: regression that cancels an accepted persona commission and asserts the refund.

### [x] 1.3 Silent renewal failure (B7)

Verify first: `slurp.storage.ts:~6155-6217` and `slurp-wallet.ts:~345-387`. On renewal failure
the wallet entry is dropped and `unsubscribe` runs; no fan-side record is written.

Fix: write a ledger entry for the failed renewal (amount 0, note = creator id) or a fan
notification, whichever already has a pattern in the code. The fan must be able to see why the
subscription ended.

### [x] 1.4 Small money fixes

- **B9** `slurp.storage.ts:~6280` (`tipCreator`): credit `floor(amount * walletCreatorRevenueSharePercent / 100)`
  like the other payments (`~5829`, `~6101`, `~6351`).
- **B10** `slurp-messages.storage.ts:~972` (`settleAudienceCommission`): use stage `"regular"`,
  like the player's accept at `~1041`.
- **B11a** Self-tip from a DM returns 402 "Not enough coins" (`slurp.storage.ts:~6274` ->
  `routes/slurp-messages.routes.ts:~583`). Return a distinct error for self-tips.
- **B11b** `notifyCreatorIncome` (`slurp.storage.ts:~6373-6380`) maps `messageRequest` to the
  `"unlock"` event kind. Map it to a correct kind; add one only if none fits.

---

## Phase 2 — Follow-up and promise pipeline

### [x] 2.1 Notes lose tags and metadata (B2)

`server/src/services/slurp/slurp-thread-notes.ts:~133` pushes `{ id, text, tier }` and drops
`tags` and `metadata`. `findPromiseNotes` (`~235`) filters on those, so it never matches.

Fix: keep `tags` (array of strings) and `metadata` (plain object) when present and valid.

Test: normalize a note with `tags: ["promise"]` and assert `findPromiseNotes` returns it.

### [x] 2.2 Follow-up list never renders (B3)

`SlurpMessages.tsx:~1841` passes `relationship?.scheduledFollowUps`. The `relationship` object in
`routes/slurp-messages.routes.ts:~360-381` has no such field, and the client type
`SlurpThreadRelationship` (`client/src/hooks/use-slurp.ts:~2142-2177`) does not declare it.

Fix: add `scheduledFollowUps: thread.scheduledFollowUps` to the route (both route copies) and the
type.

### [x] 2.3 Follow-ups ignore cool-off, night quiet and schedule (B4)

`server/src/services/slurp/slurp-follow-up-scheduler.service.ts:~101` passes `coolingOff: false`
and only checks `thread.state === "active"` (`~68`).

Fix: pass the real cool-off (`coolUntil` in the future). When cooling off, night quiet is on, or
the schedule says offline, postpone the job (reschedule) instead of sending. Reuse the helpers the
reply path uses for these checks.

Test: a due follow-up on a thread with `coolUntil` in the future is not sent.

### [x] 2.4 Follow-up outcome is dropped (B8)

Same scheduler, `~86-140`: after storing the follow-up reply, call `applyBoundary` and
`recordCreatorStateSignals` the same way `slurp-message.operation.ts` does after a normal reply.

### [x] 2.5 Dead promise wiring

`slurp-message.operation.ts:~350-363`: `relatedNoteId` is always `undefined`. After 2.1, set it
from `findPromiseNotes`. If that is not a small change, delete the dead block and add a
`ponytail:` comment instead.

---

## Phase 3 — First contact and Creator modes

### [x] 3.1 First post is public

`server/src/services/slurp/slurp-first-post-queue.service.ts:~108`: `access: "locked"` -> `"public"`.
Check the onboarding demo in `client/src/components/slurp/SlurpOnboardingPanel.tsx` and
`tests/slurp-onboarding.regression.ts:~92` (expects a "locked-post" demo screen). Adjust the
demo copy only if it now contradicts the behavior.

### [x] 3.2 Personas in onboarding (B12)

- `SlurpOnboardingPanel.tsx:~123`: `useNoodlerEligibleAccounts("", "character", open)` -> `"all"`.
- `slurp-first-post-queue.service.ts:~123-127`: a `"disabled"` result (persona Creator) must end
  the job with a terminal status that the wizard does not show as a failure. Or skip enqueueing
  persona Creators. Pick the smaller change.
- `routes/slurp.routes.ts:~2849` (bulk create): `applyAutoPosting` ignores the `null` returned for
  personas. Handle it so the response does not claim auto-posting is on.

Done when: a wizard run that includes one persona reports no failure.

### [x] 3.3 STOP — What does "managed" mean?

Today a persona-backed Creator only loses auto-posting; it still gets AI DM replies
(`replyToSlurpMessage` has no persona check) and AI comment replies. Ask the operator:

- A) Persona Creators get drafts only (existing `draft-reply` route), no automatic replies. (Recommended)
- B) Keep current behavior; just label it in the UI.

Implement the answer. Do not add a third "hybrid" mode.

---

## Phase 4 — Same Creator on every surface

### [x] 4.1 Comment replies get Creator state

`generateNoodlerCreatorReply` (`server/src/services/slurp/slurp-reply-generation.service.ts`) gets
no Creator state and no day vibe. Call `describeSlurpPostCondition(db, creator.id)`
(`slurp-post-condition.service.ts`) and pass its text into `buildNoodlerCreatorReplyMessages`.

### [x] 4.2 Posts get the modifier lines

`resolveSlurpPostStance` (`server/src/services/slurp/slurp-post-stance.ts:~81-145`) passes energy,
exposure, emotion, day vibe, goal. Add `slurpModifierLines(state)` from `slurp-creator-state.ts`.
The state is already loaded in `slurp-post-condition.service.ts:~28`.

Test: extend `tests/slurp-generation-prompts.regression.ts` (or the closest existing test) to
assert the post prompt and comment-reply prompt contain the Creator state block.

---

## Phase 5 — Payment clarity

### [x] 5.1 Profile offer card

The profile shows only "Subscribe · N / week" (`client/src/components/slurp/SlurpHome.tsx:~4090`).
Add a small block built from data that already exists (`getCreatorMessaging` settings and the
account settings): DM policy, message request fee, PPV price, and what subscribing gives
(faster replies, free DM media, subscriber posts). No new server data. Add locale keys to
`client/src/localization/locales/en.json` and run `node scripts/validate-package-locales.mjs`.

### [x] 5.2 Wallet shows what was bought

`SlurpHome.tsx:~5466` (`entryNote`) hides notes for unlock/ppv and ids of 16+ chars. Resolve the
post / Creator name and show it. The Creator name lookup at `~5428-5431` only covers managed
profiles; widen it.

### [x] 5.3 Copy for what a payment buys

In `en.json`: say a tip buys nothing; a paid message request opens a thread but does not guarantee
a reply; a commission shows its delivery time (automatic Creators: 5–45 min) and that a
stuck accepted commission can be cancelled for a refund (after 1.2).

### [x] 5.4 STOP — Cancellation behavior

Today cancel ends access now and forfeits the paid period (`slurp.storage.ts:~5945`, deliberate
comment), while the UI says "Cancel anytime". Ask the operator:

- A) Keep access until `paidThroughAt`: keep the wallet entry with `cancelled: true`, skip renewal,
  remove the subscription row when the period ends.
- B) Keep current behavior; change the copy to say access ends immediately.

Either way: add a confirmation to the "Subscribed" button (`SlurpHome.tsx:~4079`), which
unsubscribes on one click today.

---

## Phase 6 — Roleplay loop

### [x] 6.1 Payments get a reaction

A DM tip already triggers a reply (`routes/slurp-messages.routes.ts:~586-589`). A profile tip
(`slurp.storage.ts:~6281`), a post unlock (`~6105`), a PPV unlock (route `~599-609`) and a
commission accept get none. Queue one short Creator DM for each, reusing the DM-tip path. Only
for character-backed (automatic) Creators.

### [x] 6.2 User can request a Story

Guided post path: `SlurpHome.tsx:~1410-1421` sends no `postType`. `slurp-generation.service.ts:~417`
skips the variation for directed posts, so `storyVariation` is false (`~539`). Add a Story option
to the guided post UI, pass `postType: "story"`, and force the story variation when it is set.

### [x] 6.3 Posts remember the fan

`generateNoodlerPost` (`slurp-generation.service.ts:~360-450`) reads no thread notes. Add the 1–3
newest long-term notes from the Creator's most active thread, with a prompt line that they may
inspire a post but private details must not appear publicly.

### [x] 6.4 Per-Creator proactive message switch

Add a per-Creator setting (next to auto-posting in `client/src/components/slurp/SlurpSettings.tsx:~1265-1300`)
that turns off follow-ups and other unprompted DMs. The follow-up scheduler must respect it.

---

## Out of scope — do not build

- Suggest/Ask/Autonomous permission matrix across surfaces.
- Correction taxonomy, "uncertain" memory flags, DM regenerate.
- A new relationship view (it exists: `SlurpRelationshipPanel`).
- A central "resolved Creator context" module.
- Relationship milestones, audience rework.
- Version bumps, PRs, pushes.

## Background (why these tasks)

An external review said Slurp models a Creator platform better than a relationship. A code check
found parts of that review wrong: relationship state is shown (`SlurpRelationshipPanel`), notes
are editable (`SlurpMemoriesPanel`), subscribing changes reply speed, prompt text, rapport and DM
media, and posts already get part of the Creator state. The real gaps were bugs in the
follow-up/promise and money paths, a locked first post, character-only onboarding, a weak
comment-reply prompt, and payment copy that does not say what the user bought.

## Phase results

<!-- Agent: append "Phase N result" notes here. -->

### Phase 0 result

- Known-red confirmation: `slurp-alive` failed, `slurp-boundary` failed, and `slurp-population` failed as expected; `slurp-review-fixes` passed; `slurp-thread-status-and-unread` passed.
- Full `tests/slurp-*.regression.ts` loop: failed `slurp-alive`, `slurp-boundary`, `slurp-interaction-safety`, `slurp-lifecycle-safety`, `slurp-population`, `slurp-ppv-paywall`, `slurp-relationship-panel`, and `slurp-stance`; all other Slurp regression tests passed.
- `npm run typecheck:packages`: passed.
- `npm run check`: passed with 70 ESLint warnings and 0 errors.
- `node scripts/build-feature-packages.mjs slurp`: failed before generation because `/home/dev/.paseo/worktrees/0vl25jsh/mean-shark/packages/client` does not exist.
- Skipped items: none. No generated outputs were hand-edited.

### Phase 1 result

- Money paths now run on durable payment intents: claim before debit, stable wallet/earnings operation IDs, exact stored credited share on reversal, and durable operation receipts that survive the 60-entry display-ledger cap.
- Compensation is durable, idempotent and recoverable; a 60-second payment recovery scheduler retries stale intents without a restart.
- Commission acceptance, cancellation and delivery share one payment intent, a delivery claim lease (5 min) and stable message IDs.
- Tip and commission relationship effects apply once, after the business result is durable, and are best-effort on the live request.
- `tests/slurp-phase1-durability.regression.ts` executes the real storage against a file-native database with restart cycles.
- Passed: focused Slurp financial regressions, `npm run typecheck:packages`, `npm run check` (0 errors, 70 existing warnings), locale and catalog validation, `git diff --check`, and the focused Slurp rebuild.
- Known-red baseline regressions from Phase 0 remain unchanged.

### Phase 2 result

- Stored notes keep `tags` and `metadata`; `findPromiseNotes` also reads promise wording, so a note written by a reply can match.
- Follow-ups link to the promise note they came from through `relatedNoteId`; the dead placeholder block is gone.
- The thread route (both copies) and `SlurpThreadRelationship` now carry `scheduledFollowUps`, so the existing UI list renders.
- The follow-up scheduler passes the real cool-off, and postpones instead of sending during cool-off, night quiet, or an offline schedule (`postponeScheduledFollowUp`).
- Follow-up replies apply Creator state signals and the boundary exactly like normal replies.
- Passed: `slurp-thread-notes`, `slurp-follow-up-pipeline`, `slurp-relationship-phase1`, `slurp-phase1-durability`, `slurp-messaging`, typecheck, `npm run check` (0 errors), focused rebuild.

### Phase 3 result

- The queued first post is `public`, so a new Creator's feed is not empty behind a paywall. The onboarding demo screen is about locked posts in general and still reads correctly.
- Onboarding lists personas as well as characters; a persona first-post job ends as `skipped`, and the wizard counts a skip as neither a generated post nor a failure.
- 3.3 answer: option A. A persona-backed Creator is drafts only — no automatic DM reply (`replyToSlurpMessage`) and no automatic comment reply (`writeNoodlerAudienceReplies`). The existing draft routes are unchanged.
- Passed: `slurp-persona-creator-mode`, `slurp-onboarding`, `slurp-messaging`, `slurp-relationship-phase1`, typecheck, `npm run check` (0 errors), focused rebuild.

### Phase 4 result

- `generateNoodlerCreatorReply` now loads `describeSlurpPostCondition` and passes it into the comment-reply prompt as `creatorCondition`, so the comment path sees the same Creator state, day vibe, and goal the post path sees.
- 4.2 needed no change: `resolveSlurpPostStance` rule 4 already pushes `SLURP_MODIFIERS[kind].line` for every active modifier, which is exactly what `slurpModifierLines` returns. The regression now pins that.
- `tests/slurp-generation-prompts.regression.ts` asserts both.
- Passed: generation-prompt regression, typecheck, `npm run check` (0 errors).

### Phase 5 result

- The profile now shows an offer card built from the existing viewer-facing compose data: DM policy, message-request fee, PPV price, what subscribing gives, and that a tip buys nothing.
- 5.2: the wallet already resolves every Creator id in a ledger note through `listNoodlerStageProfiles`, which covers all Slurp Creators, so unlock/PPV entries name the Creator. Resolving the individual post or message would need new server data, which this task excluded; the raw id stays hidden.
- Message-request and commission copy now say what the money buys: the fee opens a thread but does not buy a reply, automatic Creators deliver in about 5–45 minutes, and a stuck accepted commission can be cancelled for a full refund.
- 5.4 answer: option A. Cancelling marks the wallet subscription `cancelled`, keeps access to `paidThroughAt`, skips the renewal charge, and the renewal sweep then expires the subscription row. The "Subscribed" button now asks for confirmation first.
- Passed: `slurp-payment-clarity` (runtime renewal behavior), wallet, inbox-wallet, earnings, durability, Phase 1 regressions, typecheck, `npm run check` (0 errors), locale validation, focused rebuild.

### Phase 6 result

- `reactToSlurpPayment` writes the payment into the thread as a viewer event and answers it through the normal reply path. Wired to profile tips, post unlocks, PPV unlocks and commission acceptance; automatic (character-backed) Creators only, best effort.
- The guided post path sends `postType`, the Slurp routes extend the shared generation schema with it, and a requested Story forces the story variation even though the rotation stands down on a directed post.
- Post generation now carries up to three long-term notes from the Creator's busiest thread, with an explicit rule that they may inspire a post but must never be named, quoted, or repeated publicly.
- Creator messaging gains `proactiveMessages` (default on), editable per Creator in Settings. The follow-up scheduler cancels queued follow-ups for a Creator whose switch is off.
- Passed: `slurp-roleplay-loop`, typecheck, `npm run check` (0 errors), locale validation, focused rebuild.

### Final gate result

- Full `tests/slurp-*.regression.ts` loop: 72 passed, 8 failed — exactly the Phase 0 known-red baseline (`slurp-alive`, `slurp-boundary`, `slurp-interaction-safety`, `slurp-lifecycle-safety`, `slurp-population`, `slurp-ppv-paywall`, `slurp-relationship-panel`, `slurp-stance`). No new failures.
- `npm run typecheck:packages`, `npm run check` (0 errors, 71 existing warnings), `git diff --check`, locale validation, catalog validation and catalog lanes all passed.
- Rebuilt with `MARINARA_ENGINE_ROOT=/home/dev/projects/Marinara-Engine node scripts/build-feature-packages.mjs slurp`. No version bump, no commit.
- Not manually tested in a running Engine: the payment reaction in a live thread, the profile offer card layout, the Story request end to end, and the cancel-subscription confirmation.
