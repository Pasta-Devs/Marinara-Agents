# Slurp2 Everyday UI Performance Status

## Scope

Make Slurp2's common UI path screen-aware: defer data the active screen does not consume, replace
full notification and inbox reads used only for shell badges with count routes, and let common
mutations settle from their returned data before background reconciliation.

- Tracking issue: Pasta-Devs/Marinara-Agents#1031, assigned to `Gunterlie`.
- Branch: `perf/slurp2-everyday-ui`, based on the merged `producing-content` commit `1eabd0ef`.
- Out of scope: Engine changes, multi-file client bundles, database redesign, simulation throughput,
  locale chunking, and wall-clock performance claims without a representative dataset.

## Verified Starting State

- The worktree contains only pre-existing untracked historical Slurp2 artifacts
  `artifacts/slurp2-0.2.10.zip` through `artifacts/slurp2-0.2.19.zip`; they are unrelated and must
  remain untouched.
- Slurp2 version is `0.2.22`; the generated artifact is `artifacts/slurp2-0.2.22.zip`.
- Client bundle is one eager `client.js`; the approved quick-win scope does not change the package
  format.
- `useSlurpHomeBaseState` currently starts the viewer feed, unseen count, full notifications, full
  inbox, eligible-source discovery, and model-connections reads from the root model.
- The Notifications and Messages destination components already own the full notification and
  thread queries, so the root copies exist only to calculate the shell badge.
- `useMarkCreatorFeedSeen` invalidates the viewer query after the first feed renders, causing a
  second full feed request. Follow, subscribe, and unlock also await their reconciliation fetches
  after applying returned scope data.
- Engine build worktree: `/home/dev/.paseo/worktrees/1432mxa9/shy-lionfish`, branch
  `welcome-to-the-agentshop`, commit `92f3eaa5`, clean at inspection.

## Planned Proof

- Focused server regressions cover count parity, persona scoping, operated-Creator inbound unread,
  declined and missing-Creator rows, missing personas, and missing-table fallbacks.
- Client/request regressions for screen-gated queries, one initial feed request, lightweight badge
  polling, and non-blocking reconciliation.
- Slurp2 architecture regression, package typecheck, browser suite, repository baseline validation,
  focused rebuild, artifact inspection, and catalog validation.

## Progress

- 2026-09-22: scope approved; issue #1031 opened; focused branch created; starting state recorded.
- 2026-09-22: the root Home model now gates feed, connection-count, eligible-source, and model-
  connection queries by the active surface. Full notifications and inbox threads no longer load for
  shell badges.
- 2026-09-22: added count-only notification and unread-message routes. The unread route filters rows
  to the viewer and operated Creators, preserves self-Creator de-duplication, and tolerates missing
  message tables through the existing storage fallback.
- 2026-09-22: feed seen, follow, subscription, and unlock mutations apply returned cache data before
  background reconciliation. Opening a thread invalidates its lightweight unread badge after the
  server marks the thread read.
- 2026-09-22: focused client request, performance, route inventory, architecture, and package
  typecheck regressions pass. Release-note, catalog, locale, and repository check gates pass.
- 2026-09-22: artifact rebuilt from Engine `92f3eaa5`; ZIP SHA-256 is
  `06ae7e6a3407d4226320a899e43472a645d31dffeb44f11822e32cf8f4ec493c`.
- 2026-09-22: package browser tests start the Engine but Chromium cannot launch because the host
  lacks `libnspr4.so`; all browser cases fail at browser launch before application assertions.
