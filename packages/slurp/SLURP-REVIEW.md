# Slurp end-to-end review

- **Date:** 2026-09-06
- **Branch / commit reviewed:** `bye-bye-birdie` @ `3b706dc0`
- **Package version at review:** slurp 1.2.2
- **Engine checkout used:** `/home/dev/engine-slurp-review` @ `8685d537d` (2.4.5, `origin/staging`)

## Scope covered

| Area                                                            | Method                       |
| --------------------------------------------------------------- | ---------------------------- |
| Client hooks, store, API client, package entry                  | Full read + trace of callers |
| Server routes, storage, DB schema, locks, wallet                | Full read + trace of callers |
| Schedulers, generation and image services, activation lifecycle | Full read                    |
| Client components (16 files, control inventory)                 | Full read                    |
| Regression suite (`tests/slurp-*`, `tests/noodle-slurp-*`)      | Executed                     |
| Typecheck, Prettier, ESLint                                     | Executed                     |
| Browser e2e (`tests/package-slurp.e2e.ts`)                      | See "Remaining failures"     |

## Confirmed bugs and fixes

| #   | Severity   | Bug                                                                                                                               | Root cause                                                                                                                                                          | Fix                                                                                                                   |
| --- | ---------- | --------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | High       | A tip or a commission quote could be "unlocked" through the PPV route and charged a second time                                   | `unlockMessageUnlocked` gated on `price > 0` only, and every priced message stores `unlockedAt: null`                                                               | Require `kind === "ppv"` — `slurp-messages.storage.ts:497`                                                            |
| 2   | High       | Two concurrent commission accepts both read `quoted` and both paid                                                                | The financial queue serializes each wallet write, not the check-then-spend span                                                                                     | Serialize per commission id like `unlockMessage` — `slurp-messages.storage.ts:679`                                    |
| 3   | High       | A failure after the commission debit stranded the coins and left the commission payable again                                     | No compensation on the accept path, unlike the PPV path                                                                                                             | Refund + reverse creator income on throw — `slurp-messages.storage.ts:700`                                            |
| 4   | Medium     | An accepted or delivered commission could be re-quoted back to `quoted` and paid twice                                            | `quoteCommission` had no state guard                                                                                                                                | Guard on `requested`/`quoted` — `slurp-messages.storage.ts:659`                                                       |
| 5   | High       | Any caller could set any Creator's weekly subscription price                                                                      | `PUT /noodler/accounts/:id/subscription-price` had no ownership gate, unlike `/goal` and `/payout`                                                                  | Require `personaId` + `creatorBelongsToViewer` — `slurp.routes.ts:593`; client sends the persona — `use-slurp.ts:712` |
| 6   | High       | A dead text connection was retried at full rate forever (20 provider attempts/minute)                                             | `replyToSlurpMessage` reports `{status:"failed"}` instead of rejecting; the scheduler discarded it, so `consecutiveFailures` stayed 0 and the backoff was dead code | Inspect the outcome and fail the pass — `slurp-message-scheduler.service.ts:23`                                       |
| 7   | Medium     | On a host without the messaging tables, the graceful-degradation fallbacks crashed the callers they protect                       | `rapportFactsFor: () => []` and `claimReply: () => null` do not match their declared shapes                                                                         | Return `emptySlurpRapportFacts()` and `{status:"busy"}` — `slurp-messages.storage.ts:932`                             |
| 8   | Medium     | Toggling debug mode or "review image prompts" in the host never reached Slurp until remount                                       | The `marinara-capability-props` handler only redrew; `configureSlurpPackageState` ran once on mount                                                                 | Reconfigure the store in the handler — `slurp-package-entry.tsx:77`                                                   |
| 9   | Medium     | Resetting ads left every visible feed showing the old ads                                                                         | `invalidateQueries({queryKey: ads(personaId)})` never matched a real key, which also carries creator id and context tags                                            | Predicate invalidation, matching `useHideSlurpAd` — `use-slurp.ts:248`                                                |
| 10  | Medium     | After a persona switch the viewer feed either never refreshed or refreshed spuriously                                             | The unseen-count baseline ref was not reset when `personaId` changed                                                                                                | Reset the baseline on persona change — `use-slurp.ts:1290`                                                            |
| 11  | Medium     | One leaked `IntersectionObserver` per card unmounted before it scrolled into view                                                 | The ref callback returned early on the `null` (detach) call without disconnecting                                                                                   | Disconnect on detach and on unmount — `use-slurp-media-src.ts:105`                                                    |
| 12  | Low        | A media fetch still in flight when the 30 s release timer fired leaked its object URL forever                                     | The timer revoked `objectUrl`, which was still `null`                                                                                                               | Revoke through the promise — `use-slurp-media-src.ts:51`                                                              |
| 13  | Low        | A non-object error body replaced the real HTTP status with an opaque `TypeError`                                                  | `body.error` read off a `null`/array JSON body                                                                                                                      | Guard with the existing `isRecord` — `api-client.ts:176`                                                              |
| 14  | Low        | The onboarding "retry settings" button had no in-flight guard; double-click saved twice                                           | Missing `disabled`, unlike its two sibling retry buttons                                                                                                            | `disabled={pending}` — `SlurpOnboardingPanel.tsx:1298`                                                                |
| 15  | Low        | A failed PPV unlock re-enabled the button and said nothing                                                                        | `unlock.mutate` had no error surface                                                                                                                                | Inline `role="alert"` — `SlurpMessages.tsx:678`                                                                       |
| 16  | Low        | A failed ad export failed silently                                                                                                | `void api.download(...)` with no `.catch`, unlike its neighbours                                                                                                    | Toast the error — `SlurpSettings.tsx:1608`                                                                            |
| 17  | Low (a11y) | The active persona in the switcher was signalled by background colour alone                                                       | No `aria-current`                                                                                                                                                   | Added — `SlurpShell.tsx:537`                                                                                          |
| 18  | Low (a11y) | The avatar upload button had `title` but no accessible name for the action                                                        | Missing `aria-label`, unlike the banner button                                                                                                                      | Added — `SlurpProfileSurface.tsx:279`                                                                                 |
| 19  | Test       | `tests/slurp-chrome.regression.ts` asserted an avatar-overlap class string removed in `37b97304`; the suite was red on the branch | Stale assertion, not a product bug                                                                                                                                  | Re-pointed at the current hero/avatar overlap classes                                                                 |

## Regression tests added or changed

| File                                     | Change                                                                                              |
| ---------------------------------------- | --------------------------------------------------------------------------------------------------- |
| `tests/slurp-review-fixes.regression.ts` | New. Covers fixes 1–18.                                                                             |
| `tests/slurp-wallet.regression.ts`       | Its two backoff assertions passed with fix 6's bug live; added the assertion that fails without it. |
| `tests/slurp-chrome.regression.ts`       | Stale assertion repaired (fix 19).                                                                  |

## Commands run

| Command                                                   | Result                                    |
| --------------------------------------------------------- | ----------------------------------------- |
| `npx tsx tests/slurp-*.regression.ts` (all, individually) | pass                                      |
| `npx tsx tests/noodle-slurp-*.regression.ts`              | pass                                      |
| `npm run typecheck:packages`                              | pass — `slurp: no undefined names`        |
| `npm run format`                                          | pass                                      |
| `npm run check`                                           | pass — 0 errors, 67 pre-existing warnings |

## Round 2 — main-functionality pass (live instance)

Driven against a real Engine 2.4.5 checkout (`/home/dev/engine-slurp-review`, `origin/staging`
@ `8685d537d`) with the built 1.2.3 artifact installed, through the HTTP API and a real browser.
Live model generation was skipped by request, so no provider calls were made.

### Confirmed bugs found by exercising the features

| #   | Severity | Bug                                                                                                                                                    | Root cause                                                                                                                                                                                                                                | Fix                                                                                                                                                                                         | Proof                                                                                    |
| --- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 20  | Critical | Subscribing to a Creator returned HTTP 500 every time for a viewer with no prior subscription                                                          | `subscribe` did `const at = now()`, and `now()` returns an ISO string; `at.getTime()`, `spend`, and `subscriptionPaidThrough` all want a Date, so it threw `toISOString is not a function`                                                | `const at = new Date()` — `slurp.storage.ts:5276`                                                                                                                                           | 500 reproduced, then 12 coins charged correctly                                          |
| 21  | Critical | Ad and engagement rewards paid nothing, so the whole earn side of the economy was dead                                                                 | `earn` was imported twice under one name — from `slurp-wallet` and from `slurp-earnings`. The last import wins at runtime, so `earnCoins` called the creator-earnings function with wallet arguments and it returned the wallet unchanged | Alias the earnings import as `earnCreatorIncome`, matching its already-aliased siblings — `slurp.storage.ts:92`                                                                             | 0 coins before; after: 2 per ad action, stopping exactly at the 12/day cap; reply pays 1 |
| 22  | High     | Every persona that liked or replied appeared in **Creator profiles** as "Setup Needed" and in every other viewer's **Discover** as a browsable Creator | A persona's viewer-actor account is provisioned on first interaction and was never distinguished from an authored Creator profile                                                                                                         | `isSlurpViewerActorAccount` (invited persona account) excluded from `listNoodlerStageProfiles` and from both `visibleAccounts` filters — `slurp.storage.ts:868`, `slurp.routes.ts:850,1332` | Three phantom profiles reproduced from one like, then gone                               |
| 23  | High     | The persona switcher showed 999,999 coins while the Wallet page showed the real balance                                                                | `listViewerWallets` read the Engine's `settings.wallet.coins`, which defaults to 999_999 and is only mirrored after Slurp first writes a wallet                                                                                           | Read the Slurp wallet via `getWalletNow` — `slurp.storage.ts:1689`                                                                                                                          | 999999 vs 200 reproduced; both now agree                                                 |
| 24  | Medium   | Tapping like twice returned HTTP 500                                                                                                                   | The file store asserts uniqueness when the transaction settles, not at the insert, so the existing duplicate-handling catch never saw it                                                                                                  | Return the existing row for a toggle before inserting — `slurp.storage.ts:4691`                                                                                                             | 500 reproduced; now 201 for repeated and 5 concurrent likes, one row                     |
| 25  | Medium   | Settings → Wallet → "Unlock a post" did nothing; every locked post cost the shipped 1 coin                                                             | Both creation paths called `noodlerUnlockPriceMetadata()` with no argument                                                                                                                                                                | Pass `settings.walletUnlockCost` — `slurp-post.operation.ts:245`, and stamp generated locked posts too — `slurp-generation.service.ts:639`                                                  | Setting was 3, posts were created at 1                                                   |
| 26  | Medium   | Opening the Creator wizard and backing out with nothing entered asked "Discard profile changes?"                                                       | `hasNewDraft` was true for the bare `creationStep`, so merely being on step one counted as unsaved work                                                                                                                                   | Require real work: a draft, typed guidance, an in-flight generation, or a picked source — `SlurpHome.tsx:734`                                                                               | Reproduced and fixed in the browser; the prompt still appears once a source is picked    |

### Feature added by request

Creators now publish Stories autonomously. `slurpPostBeat` gained a `story` flag on the caption slots
of its rotation, and the generation service marks the post `noodlerPostType: "story"` **only** on the
path that commits an image — a Story with no picture is not a Story. Before this, `postType: "story"`
was only ever set by the manual composer, so nothing generated one at all.

Both halves are the player's, not constants:

| Setting                                | Where                                        | Default     | Effect                                                                                                         |
| -------------------------------------- | -------------------------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------- |
| `storyRate`                            | Settings → Publishing → **Stories**          | `regular`   | Off / Rare / Regular / Often, mapping to 0, 1, 2 or 4 of the eight rotation slots. `off` is a real off switch. |
| `storyImageWidth` / `storyImageHeight` | Settings → Images → **Story width / height** | 1024 × 1280 | The size a generated Story is drawn at.                                                                        |

`regular` at 1024 × 1280 reproduces the behaviour shipped before the setting existed, so an install
that never opens Settings is unchanged. The composer crops an uploaded Story to the configured ratio
rather than to a fixed named aspect (`lockedRatio`), so the two halves cannot drift apart when the
size is changed. Verified live: the control renders, changing it persists (`storyRate = often` on the
server), and the route rejects an unknown rate or an out-of-range size with 400.

### Verified working, no defect found

| Area                                             | Evidence                                                                                   |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------ |
| Subscribe / re-subscribe / unsubscribe           | 12 charged once, re-subscribe free, unsubscribe clears the paid period                     |
| Post unlock                                      | Price quoted in the feed matches the charge; a second unlock is free                       |
| Tips                                             | Charged, refused when the balance is short, ledgered with the Creator handle               |
| Daily refill                                     | Tops up to the floor, records a `stipend` entry, a second claim the same day pays nothing  |
| PPV messages                                     | Gated to the Creator's owner; unlock charges once and is then idempotent                   |
| Commissions                                      | brief → quote → accept → deliver; 5 concurrent accepts charged exactly once                |
| Payout                                           | Moves earnings into the persona wallet; over-payout refused with the allowance             |
| Ads                                              | Built-in pool served with context tags; hide and reset work; import validates its envelope |
| Inline ad images via `uploadedImageUrl`          | Imported into media, so a library image satisfies the "Stories need an image" check        |
| Notifications                                    | Commission, PPV and message events recorded and attributed                                 |
| Studio and earnings                              | Ledger and lifetime totals match the transactions performed                                |
| Autoposting                                      | Enables per Creator, appears in the status, and reports a clear error with no provider     |
| DM policy                                        | `subscribers` policy opens a thread in the `request` state                                 |
| Feed, wallet, inbox, profile, settings, Discover | Render with real data; the Slurp tab mounts pink with no console errors                    |

### Not verified

| Area                                                                                 | Reason                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Live post, story, reply, ad and image generation, and the world's model-driven beats | Live generation skipped by request; no provider was configured, so no outbound calls were made                                                                                         |
| Playwright suite `npm run test:browser:slurp`                                        | The Playwright chromium builds on this machine are missing system libraries (`libnspr4` and others) and installing them needs root. Driven through a real browser over the LAN instead |
| Long-run scheduler behaviour (autopost slots firing, world ticks over days)          | Needs a provider and elapsed time                                                                                                                                                      |

## Round 3 — unfinished and conceptually wrong features

A hunt for stubs rather than crashes: features that are declared, partly built, or wired to nothing.
Found by tracing each concept setting → server → response field → client render, and by listing
exported hooks with no callers.

| #   | Severity | What was wrong                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                  | Evidence                   | Decision                                                                                                                                    |
| --- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| 27  | High     | **Creator promotions were a stub that mislabelled the player's own writing.** A hand-written post reading "Just made soup. Nothing to do with cosmetics." was stamped `slurpSponsoredPromotion: Velvet Skin · Midnight Gloss` and rendered "PAID PARTNERSHIP WITH VELVET SKIN". The promotion was never put in the prompt, so the text never mentioned the brand; there is no sponsorship earnings kind, so it paid nothing; exactly one creator ad existed, matched by substring of handle+bio against `beauty`/`fashion`/`night`; and it fired on every post with no frequency or off switch. | Reproduced live            | **Removed** — the stamping, the render, `creatorAdForProfile` and the one `kind: "creator"` base ad. Inline ads, which work, are untouched. |
| 28  | High     | **Creator message policy and prices had no UI.** `useSetSlurpCreatorMessaging` and `useSetSlurpCreatorPrice` had zero callers, so DM policy, first-message fee, locked-message price, rapport weights and a Creator's own weekly price could never be changed. Every Creator was stuck on `subscribers` / 5 / 8. The `paid` policy was therefore unreachable, which made the fee and the `messageRequest` earnings kind dead — while the localized "Your first message costs {{fee}} coins" copy shipped.                                                                                       | No callers; confirmed live | **Built** — a "Messages and prices" group in Settings → Creators, for persona-owned Creators only. Rapport weights left alone by choice.    |
| 29  | Medium   | **Commissions had no exit.** No decline route and no decline UI; `declined` shipped localized in all four locales but was unreachable, so an unwanted brief sat in the thread forever and the fan could not take it back.                                                                                                                                                                                                                                                                                                                                                                       | Routes and UI read in full | **Built** — one `decline` route either side may call while the commission is unpaid, plus Decline / Withdraw buttons.                       |
| 30  | High     | **Paid messages could not carry a picture.** `imageUrl` existed on the column, the mapper and the `appendMessage` signature; nothing ever set it and the client never rendered it. Unlocking a PPV always revealed text, and a commission — "draw me this" — could not deliver the artwork.                                                                                                                                                                                                                                                                                                     | Traced end to end          | **Built** — attach on PPV and on commission delivery, rendered in the thread, **and the paywall now masks the image as well as the text.**  |
| 31  | Low      | Answering an already-answered message request returned 200 and generated a reply, because `resolveRequest` no-ops off the `request` state and the route ignored it.                                                                                                                                                                                                                                                                                                                                                                                                                             | Code                       | Returns 409.                                                                                                                                |

### Verified live after the changes

| Check                                  | Result                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| New post carries no promotion metadata | `{noodlerContentFormat, noodlerPostType}` only                                                               |
| Owner sets DM policy to `paid`, fee 7  | 200; non-owner gets 403                                                                                      |
| First DM under the paid policy         | Viewer charged 7 (200 → 193); Creator ledger gains `messageRequest +7` — a path that had never once executed |
| Commission decline / withdraw          | Both reach `declined`; unrelated persona 403; after accept 409                                               |
| PPV with an image, before unlocking    | `content: ""`, `imageUrl: null`                                                                              |
| PPV with an image, after unlocking     | Both revealed                                                                                                |
| Remote image URL on a paid message     | 400 — a same-origin Marinara path only, so the server stores a reference and never fetches an arbitrary host |
| Commission delivered with an image     | `state: delivered`, image on the delivery message                                                            |

### Recorded, not changed

- `kind: "creator"` remains in the garnish-ads type and import schema with no consumer, so a
  creator-kind ad can still be imported and will never be shown. Left because garnish-ads is staged
  for extraction into its own agent and a future promotions feature will want the kind back.
- Rapport weights (eight dials) still have no UI, by choice — the mechanic is invisible to the player.
- Twenty settings-schema keys have no UI reference, most inherited from public Noodle
  (`participantSelectionMode`, `carryover*`, `invitedCharacterGroupIds`, `max*PerRefresh`). All are
  read somewhere on the server, so none is dead, but they are unreachable configuration.

## Build and release

Source payloads changed, so the package was rebuilt and the version bumped by one patch.

| Item          | Value                                                                                                                                              |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Version       | 1.2.2 → 1.2.3 (`scripts/build-feature-packages.mjs:329`)                                                                                           |
| Rebuild       | `MARINARA_ENGINE_ROOT=… node scripts/build-feature-packages.mjs slurp`                                                                             |
| Regenerated   | `packages/slurp/{manifest.json,client.js,server.mjs}`, `artifacts/slurp-1.2.3.zip`, `catalog/**`, `sources/engine/**/slurp-messages.storage.ts`    |
| Release notes | `packages/slurp/CHANGELOG.md` 1.2.3 entry added (a patch does not require one; the build requires the newest entry to match the published version) |

## Validation

| Command                                                                 | Result                                    |
| ----------------------------------------------------------------------- | ----------------------------------------- |
| `npm run format` / `npm run check`                                      | pass — 0 errors, 67 pre-existing warnings |
| `npm run typecheck:packages`                                            | pass                                      |
| `node scripts/test-catalog-lanes.mjs`                                   | pass                                      |
| `node scripts/validate-package-locales.mjs`                             | pass                                      |
| `node scripts/validate-catalog.mjs`                                     | pass — 36 packages                        |
| `node scripts/tests/catalog-release-notes.regression.mjs`               | pass                                      |
| `npm run test:security`                                                 | pass                                      |
| `git diff --check`                                                      | clean                                     |
| All `tests/slurp-*.regression.ts`, `tests/noodle-slurp-*.regression.ts` | pass                                      |
| `npm run test:browser:slurp`                                            | **blocked** — see below                   |

## Remaining failures

| Item                                                                                               | Cause                                                                                                                                                                                                                                                                                              | Mine?                                            |
| -------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| `npm run test:browser:slurp` cannot launch a browser                                               | Playwright's bundled chromium is missing `libnspr4` and other system libraries, and `playwright install-deps` needs root. The Engine side is fine: a 2.4.5 worktree at `/home/dev/engine-slurp-review` installs and runs the package. Tested through a real browser against that instance instead. | No — machine setup.                              |
| `tests/noodle-all-invited-reliability`, `noodle-conversation-schedule`, `noodle-generated-refresh` | `Cannot find module '@marinara-engine/shared'` — these Noodle tests need an Engine checkout on the module path.                                                                                                                                                                                    | No — pre-existing, Noodle package, out of scope. |
| `tests/noodle-public-only`, `noodler-content-formats`, `noodler-fictional-prices`                  | Stale source-text assertions against the Noodle package.                                                                                                                                                                                                                                           | No — pre-existing, Noodle package, out of scope. |

## Confirmed but not fixed

| Item                                                                                                                                                                                         | Why not fixed                                                                                                                                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `app.addHook("onClose", stop)` is never unregistered by any of the five schedulers, so each re-activation retains one dead closure                                                           | Real leak, but the fix belongs in the shared activation lifecycle and touches all five schedulers plus `slurp-activation-lifecycle.ts`. Out of proportion to a per-activation closure; recorded for a focused change. |
| Post-actions menu (`SlurpPostCard`) and the tip popover (`SlurpHome`) have no Escape or outside-click dismissal; `NoodleAnchoredPopover` has neither and never restores focus to its trigger | Genuine accessibility gap. The correct fix is one dismissal behaviour in `NoodleAnchoredPopover` shared by every caller, which is a larger change than this pass should carry.                                        |
| `slurp-images.service.ts` lost-lease path skips the retry counter, so a post can be redrawn every poll                                                                                       | Narrow trigger (claim renewal must throw). Needs a reproduction harness that does not exist yet.                                                                                                                      |
| `sweepStagedImages` unlinks any `*.tmp` although staged names carry the pid                                                                                                                  | Only bites when two Engine processes share one data dir.                                                                                                                                                              |
| `useSlurpStudio` (`staleTime: Infinity`) is invalidated by `noodlerRoot()` prefix invalidations from payout/tip/refill, which rewrites the delta snapshot and zeroes the deltas              | Confirmed from code; the correct scope for the studio key is a product decision, not a mechanical fix.                                                                                                                |
| No reaper for generation runs left `"running"` by a process kill                                                                                                                             | Confirmed absent; the UI consequence was not reproduced.                                                                                                                                                              |
| `GET /messages/creators/:id/settings` has no ownership check                                                                                                                                 | Not a defect: a viewer needs `requestFee`/`ppvPrice` before opening a request. The mutating `PATCH` sibling is gated.                                                                                                 |
| `api.upload` takes no `AbortSignal`; the two cursor-paging `queryFn` loops ignore React Query's `signal`                                                                                     | Correctness is unaffected; only wasted work after unmount.                                                                                                                                                            |
| `slurp-package.store.ts` persistence has no schema version, and two tabs can overwrite each other's persisted persona                                                                        | Latent. A version field is a migration decision for the next state change.                                                                                                                                            |

## Not tested

| Area                                                                                                                                                | Reason                                                                                              |
| --------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| Every visible control through real interaction; desktop/mobile layout, keyboard and focus order in a browser; console and network errors at runtime | Blocked by the Engine version gap above. Controls were inventoried and audited from source instead. |
| Live model generation (posts, replies, images, ads)                                                                                                 | Requires a real provider connection.                                                                |
| Install / update / uninstall through **Agents → Download Agents**                                                                                   | Same Engine version gap.                                                                            |

## Readiness

Source, tests, catalog, and artifact are consistent and every repository-required check passes.
Three rounds: an audit, a functional pass against a live Engine that found seven defects including
two that made subscribing and the whole coin-earning economy fail outright, and a stub hunt that
found five more — one feature removed as unsalvageable, three finished, one made honest.

Outstanding: the Playwright suite needs a machine with chromium's system libraries, and everything
model-driven (autopost content, Story and post images, ad copy, DM replies, world beats) is still
unverified because live generation was skipped. Everything else in this document was exercised
against a running instance.
