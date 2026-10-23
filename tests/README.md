# Capability integration tests

Downloadable feature packages can run browser coverage against a neighboring
Marinara Engine checkout with the package runner. The runner starts isolated
desktop and mobile Engine instances, installs the exact committed package
artifact into both fresh data directories, and then executes the requested
Playwright suite:

```bash
npm run test:browser:noodle
```

Set `MARINARA_ENGINE_ROOT` when the compatible Engine checkout is not at
`../Marinara-Engine`. The Engine checkout must have its pnpm dependencies and
Playwright Chromium browser installed.

`spatial-context.e2e.ts` is the World Maps package's browser integration suite. It was moved with the feature so the lightweight Engine smoke suite does not require optional routes or UI to exist.

Run it against a Marinara Engine checkout that has the local World Maps package installed and active, using the Engine Playwright configuration:

```bash
cd ../Marinara-Engine
pnpm exec playwright test ../Marinara-Agents/tests/spatial-context.e2e.ts -c playwright.config.ts
```

The package must be installed in the test data directory before launching the Playwright web server.

Noodle prompt-boundary escaping and hinted-identity redaction can be checked with
the Engine TypeScript runner:

```bash
cd ../Marinara-Engine
pnpm --filter @marinara-engine/server exec tsx ../Marinara-Agents/tests/noodle-prompt-safety.regression.ts
```

The Long-Term Memory regressions cover storage, extraction, runtime recall,
privileged routes, debug logging, and the exact release artifact lifecycle.
Most suites import only the package source, so they run from this checkout with
the locked dev dependencies (`npm ci`) and no Engine:

```bash
set -e
for test in candidate-reconciliation conversation-summary-import debug-log debug-activity delta-review \
  extraction-graph extraction-reliability index-keys local-characters \
  review-queue-ambiguous-link runtime scope-fallback-labels scope-targets source-pagination source-task storage tab-keys; do
  npx tsx "tests/long-term-memory-${test}.regression.ts"
done
node tests/long-term-memory-feedback-clarity-ui.regression.mjs
```

`storage` asserts a read-only directory failure with `chmod`, so run it as a
non-root user.

The suites that need the Engine server or Engine's Playwright and Vite/Tailwind
toolchain run through the Engine checkout's `tsx`:

```bash
cd ../Marinara-Engine
pnpm --filter @marinara-engine/shared build
set -e
for test in browser routes routes-scope-identity routes-backup installation host-styles; do
  MARINARA_ENGINE_ROOT="$PWD" pnpm --filter @marinara-engine/server exec tsx \
    "$PWD/../Marinara-Agents/tests/long-term-memory-${test}.regression.ts"
done
```

`.github/workflows/ltm-browser.yml` runs the same split: the Engine job runs
`browser` first and then the loop above, and the `ltm-node` job runs the
Engine-free Long-Term Memory suites in parallel. `index-keys` and the
feedback-clarity/focused helper suites already run in the pull request checks.

The completion watchdog proof is a direct Node test:

```bash
node "$PWD/../Marinara-Agents/tests/regression-helpers.regression.mjs"
```

The browser fixture compiles Engine's `globals.css` with Engine's installed
Vite and Tailwind plugin before launching Chromium. Use that fixture for visual
review evidence; serving `globals.css` directly leaves Tailwind directives
unprocessed and is not a valid visual pass.

New standalone package browser fixtures should reuse
`compileEngineVisualStyles()` from `engine-visual-styles.ts` and include their
package client source glob. The helper fails if Tailwind directives remain in
the served CSS, preventing raw-stylesheet screenshots from being accepted as
visual evidence.

Set `MARINARA_VISUAL_OUTPUT_DIR` to capture compiled-style mobile and desktop
review queue screenshots while running the browser fixture:

```bash
MARINARA_ENGINE_ROOT="$PWD" MARINARA_VISUAL_OUTPUT_DIR=/tmp/marinara-visuals \
  pnpm --filter @marinara-engine/server exec tsx \
  "$PWD/../Marinara-Agents/tests/long-term-memory-browser.regression.ts"
```

## Social source regressions

Run the complete Noodle and Slurp source suite from
this checkout after `npm ci`:

```bash
MARINARA_ENGINE_ROOT=../Marinara-Engine npm run test:noodle:regressions
```

The neighboring Engine needs its installed dependencies and built shared
package. Source-only fixtures use `tests/tsconfig.regressions.json` to resolve
`@marinara-engine/shared` through the same captured compatibility entry as the
package builder. The Slurp file-native durability fixture instead uses the
real Engine's shared module and an isolated temporary source/data overlay.
It preserves the host's legacy tables while registering Slurp's
package-owned tables. No real user data or provider connection is used.

## Long-Term Memory test ownership

Choose the narrowest layer that exercises a contract. Similar assertions at
different boundaries are not duplicates: remove one only when the surviving
check exercises the same inputs and cannot pass while the removed check fails.

| Layer | Owning suites (`long-term-memory-*.regression.*`) | Contracts |
| --- | --- | --- |
| Direct services | `storage`, `runtime`, `extraction-graph`, `extraction-reliability`, `conversation-summary-import`, `candidate-reconciliation`, `delta-review` | Storage recovery/quarantine, lineage-safe retraction, draft dependencies, activity persistence, retrieval lanes and scope, receipt idempotency/redaction, extraction graph validation, identity/dedup boundaries, bounded candidate reconciliation and recall beyond the prompt window, import invariants |
| Focused helpers | `index-keys`, `local-characters`, `scope-targets`, `scope-fallback-labels`, `source-task`, `source-pagination`, `tab-keys`, `review-queue-ambiguous-link`, `debug-log`, `debug-activity` | Unsafe keys, per-lane score calibration, local identity isolation, scope selection/labels, task cancellation, debug persistence, debug event filtering/status and id lookup |
| HTTP integration | `routes-scope-identity`, `routes-backup`, and the direct `routes` scenario | Auth/permissions, validation, statuses and client-consumed errors, request-to-service and response-to-persistence mapping, scope translation, applied mutation IDs, preflight, cancellation, backup semantics |
| Browser | `browser`, `feedback-clarity-ui` | Visible workflows, request construction, response consumption, archive undo/partial failure, review/re-extraction, activation, loading and layout; retain explicit static contracts where behavioral proof is absent |
| Installation and styles | `installation`, `host-styles` | Exact ZIP install, offline restart, full-backup inclusion, uninstall/reinstall and durable-byte preservation; every utility class the package uses exists in the Engine's compiled stylesheet |
| Repository integrity | `node scripts/validate-catalog.mjs` | Manifest-derived lanes and legacy alias, catalog/manifest agreement, artifact URLs, hashes, sizes, archive contents and package contracts |

`routes-scope-identity` and `routes-backup` share `long-term-memory-routes.regression.ts`
but run in separate processes because they start from a seeded note and assert
state the direct `all` scenario has already changed. The `all` scenario also
contains unique checks; do not remove it as a redundant aggregator. The former
`routes-notes`, `routes-imports` and `routes-drafts` entrypoints and the
`lifecycle` wrapper ran only assertions that `all` and the `browser` and
`installation` suites already run, so they were removed. Browser API responses are
fixtures, not proof of server behavior, and direct source tests do not prove
that the committed ZIP works. Run the repository baseline as well as LTM tests.

### Cross-layer deletion evidence

Phase 5 (#767) removes only `assertCatalogArtifact()` and its call from the
browser suite. At baseline `31b391346905318c3b58cf4e4c9990ae5afaaf11`, this
block was at `long-term-memory-browser.regression.ts:50-68,137`.

| Removed check | Surviving check in `scripts/validate-catalog.mjs` | Why it cannot fail independently on the same repository inputs |
| --- | --- | --- |
| LTM entry in v2/v3 and the legacy catalog | Manifest-derived lane equality and legacy alias (109-121), exact downloadable ID set (834-840) | Missing entries fail lane equality or the official package ID check; the current LTM manifest selects v2 and v3. |
| Catalog version equals package version | Full source-manifest equality (572-575) | Version is part of the compared manifest; divergent lane entries also fail equality. |
| Official artifact URL | `expectedArtifactUrl` comparison (540-544) | It compares the same package ID/version-derived URL. |
| Artifact SHA-256 and byte count | Archive size and checksum comparisons (576-585) | Both read the same versioned ZIP and compare the same SHA-256 and byte count. |

These checks read committed files, not browser state. Keep the browser's own
artifact identity guards and actual client interactions, and keep installation
durability checks unchanged. No route/service mapping or user-visible assertion
is removed: cancellation, schema limits, persisted/response/draft/mutation
scopes, applied mutation IDs, backup/preflight payloads, and browser request
payloads can fail independently at their respective boundaries.

### Phase 6: merges and static-check removals

Baseline `97fb847e6ea090e6cc12f56d112d8c87d3353720`. Line numbers in the first
two columns are from that commit.

Merged, nothing removed: `reconciliation-recall` now runs as the second block of
`candidate-reconciliation` (same service, issue #1085); the client `api.ts`
note-request checks moved from `storage` to `source-pagination`; the
`display-labels` unit checks moved from `browser` to `scope-fallback-labels`.
`loading` moved into `feedback-clarity-ui`, except the route-source checks
(`scope-targets` returns `localCharacters: []`, `/local-characters` loads the
trusted catalog), which `routes` proves over HTTP, and a `vault`
`scopeTargetsQueryOptions` check that `feedback-clarity-ui` already makes.

| Removed check | Surviving check | Why it cannot fail independently |
| --- | --- | --- |
| `runtime` 12-17: manifest `capabilityApi` is `{1, 6}` | `scripts/validate-catalog.mjs` compares `manifest.capabilityApi` to `engine-boundary.json`, and `readPackageEngineBoundary` requires that file to declare `{1, 6}` | Both read the same manifest field; any other value fails the equality or the boundary check. The `engine.min` assertion stays: the catalog validator only enforces a `2.3.0` floor, not `2.4.1`. |
| `browser` 119-123: description names `Chat Settings → Agents → Long-Term Memory` | `validate-catalog.mjs` requires the description to end with the activation text for the package | That text contains the asserted string. The `Misc Agents for Conversation` exclusion stays because the base description is not constrained. |
| `feedback-clarity-ui` 316, 317, 509 | The same regexes at 280, 282, 259 | Exact duplicates in the same file against the same source. |
| `feedback-clarity-ui` locale and key checks: 114, 116, 146, 740 (activity labels), 141 (index rebuild failure), 197, 198, 200 (availability controls), 378, 380 (scope view and `No second place`), 417 (`Open debug log`), 461, 463, 464 (archive undo), 683 (`Retry failed review actions`) | The `browser` suite asserts the same visible text against the built client at 2747-2947, 3543, 2056, 2060, 4633, 1688, 1964, 3247, 4697-4745, 4025 | The browser renders these keys from the committed ZIP's `client.js`, so a changed or missing string fails there. |
| `feedback-clarity-ui` 429-433 (`deleteConfirmation*` fields) | `browser` 4809-4817 asserts the confirmation title, hidden-by-filters notice, ids, excerpt and scope | The fields exist only to build that message. |
| `feedback-clarity-ui` 664, 665 (`data-ltm-review-preflight`, `data-ltm-review-conflicts`) | `browser` 3994-3999 | Locates and counts both attributes in the rendered review queue. |
| `feedback-clarity-ui` 271 (`radiogroup`/`radio` roles) | `browser` 1704, 1811 | Locates the scope rows by those roles. |
| `feedback-clarity-ui` 503 (memory group summary is `min-h-11` with a focus outline) | `browser` 1887 | Tabs to the summary and asserts a visible outline and a height of at least 44px. |
| `feedback-clarity-ui` 312 (`TargetPicker` uses `nextTabIndex`) | `browser` 4565-4573 | Drives ArrowRight, Home and End across the availability tabs. |
| `feedback-clarity-ui` 86-89 (`#ltm-bulk-destination-list` is `overflow-y-auto`) | `browser` 5222-5257 | Asserts the computed `overflow-y` and wheel scrolling on that element. |
| `feedback-clarity-ui` 101-105 (two `data-ltm-source-task-count` owners) | `browser` 5378-5385 | Asserts exactly one visible count owner while a source task runs. |
| `delta-review` `export const completion` | None needed | Nothing imports it. |

The browser asserts the committed ZIP's `client.js` and these checks read
source. They diverge only when the bundle is stale, which `validate-catalog.mjs`
already rejects for manifests and hashes and the repository's rebuild rule
forbids. Kept because the browser has no clear counterpart: the one-memory
archive message (462), the `combinedScope` and `noMemoriesInCombinedScope`
strings (381-383), every `min-h-11` check except 503 (504-508), the workspace
`nextTabIndex` check (330), the destination panel size and `details` classes
(84, 90-92), the locale-key completeness block, and every check in the
no-browser-coverage set (source-task live region, keyword editor,
rename/unsaved dialogs, import result modes, `data-ltm-tab-focus`, activity
warnings, last-injection outcomes, availability loading/error).

## Exact-artifact lifecycle regression

`hierarchical-maps-lifecycle.regression.ts` installs an immutable prior Maps
artifact through an isolated catalog, updates to the exact current artifact,
then proves reviewed existing-campaign Game map reconciliation, offline restart,
uninstall, reinstall, full-backup creation, and full-backup restore without
deleting the stored definition or spatial snapshot.

Run it with the Engine server toolchain so the package is exercised against the
real host runtime:

```bash
cd ../Marinara-Engine
pnpm --filter @marinara-engine/server exec tsx ../Marinara-Agents/tests/hierarchical-maps-lifecycle.regression.ts
```
