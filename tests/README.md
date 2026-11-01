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

Before the Engines start, the runner reads the live staging catalog lane and
preview overlay they compare installed packages with. Where a published version
differs from the one it installs, it records that version as declined, so a
branch behind `staging` does not open the Agent update prompt over the suite. A
version published during the run can still open it. If you set
`MARINARA_AGENT_CATALOG_URL`, the runner declines nothing and the Engine offers
that catalog's updates as usual.

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
privileged routes, debug logging, and the exact release artifact. Suites that
import only package source and Agents dependencies run from this checkout after
`npm ci`:

```bash
set -e
for test in candidate-reconciliation conversation-summary-import debug-log debug-activity delta-review extraction-graph extraction-reliability index-keys local-characters rebuild-job runtime review-queue-ambiguous-link scope-targets scope-fallback-labels source-pagination source-task tab-keys; do
  npx tsx "tests/long-term-memory-${test}.regression.ts"
done
node tests/long-term-memory-feedback-clarity-ui.regression.mjs
```

Suites that need the Engine checkout's server, dependencies, shared sources,
styles or Playwright run through its TypeScript runner:

```bash
cd ../Marinara-Engine
set -e
for test in browser storage branch-recall engine-fields routes routes-imports routes-scope-identity routes-backup installation host-styles; do
  MARINARA_ENGINE_ROOT="$PWD" pnpm --filter @marinara-engine/server exec tsx \
    "$PWD/../Marinara-Agents/tests/long-term-memory-${test}.regression.ts"
done
```

The completion watchdog proof is a direct Node test:

```bash
node tests/regression-helpers.regression.mjs
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
| Direct services | `storage`, `runtime`, `extraction-graph`, `extraction-reliability`, `conversation-summary-import`, `candidate-reconciliation`, `branch-recall`, `rebuild-job`, `delta-review` | Storage recovery/quarantine, lineage-safe retraction, draft dependencies, activity persistence, retrieval lanes and scope, receipt idempotency/redaction, extraction graph validation, identity/dedup boundaries, bounded candidate reconciliation and recall beyond the prompt window, branch recall, index rebuild jobs, delta review, import invariants |
| Focused helpers | `index-keys`, `local-characters`, `scope-targets`, `scope-fallback-labels`, `source-task`, `source-pagination`, `debug-log`, `debug-activity`, `tab-keys`, `review-queue-ambiguous-link`, `engine-fields` | Unsafe keys, per-lane score calibration, local identity isolation, scope selection/labels, task cancellation, source paging, debug persistence, debug event filtering/status and id lookup, Engine field contracts |
| HTTP integration | `routes-imports`, `routes-scope-identity`, `routes-backup`, and the direct `routes` scenario | Auth/permissions, validation, statuses and client-consumed errors, request-to-service and response-to-persistence mapping, scope translation, applied mutation IDs, preflight, cancellation, backup semantics |
| Browser | `browser`, `host-styles`, `feedback-clarity-ui` | Visible workflows, request construction, response consumption, archive undo/partial failure, review/re-extraction, activation, loading and layout; retain explicit static contracts where behavioral proof is absent |
| Installation | `installation` | Exact ZIP install, offline restart, full-backup inclusion, uninstall/reinstall and durable-byte preservation |
| Repository integrity | `node scripts/validate-catalog.mjs` | Manifest-derived lanes and legacy alias, catalog/manifest agreement, artifact URLs, hashes, sizes, archive contents and package contracts |

The split route entrypoints share `long-term-memory-routes.regression.ts` but
run in separate processes. Its direct `all` scenario holds the notes and drafts
checks and other unique checks; do not remove it as a redundant aggregator. The
`imports`, `scope-identity` and `backup` entrypoints start from their own seed
and keep scenario-only assertions. Browser API responses are
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

### Phase 6: merges and duplicate removals

Phase 6 (#1618) merges small suites into their nearest owner and removes checks
that another check already proves on the same inputs. Line numbers refer to
baseline `9f8a5d81a`.

| Moved checks | New owner |
| --- | --- |
| `long-term-memory-reconciliation-recall.regression.ts` (whole suite) | `candidate-reconciliation`, as `recallBeyondPromptWindow()` |
| `api.ts` note paging, `storage` 11-73 | `source-pagination`, as `noteRequestPaging()` |
| `display-labels.ts` localized labels, `browser` 76-93 | `scope-fallback-labels` |
| `long-term-memory-loading.regression.mjs`, except the checks below | `feedback-clarity-ui` |

| Removed check | Surviving check | Why it cannot fail independently on the same repository inputs |
| --- | --- | --- |
| `feedback-clarity-ui` 341 `filterModes`, 342 no `scopeModes`, 349 `data-ltm-scope-tablist`, 545 `data-ltm-memory-scope-secondary` | Same assertions at 301, 303, 290, 259 | Identical top-level assertions on the same source strings. |
| `loading` 18 vault `useQuery(scopeTargetsQueryOptions(...))` | `feedback-clarity-ui` 343 | Identical assertion on the same source string. |
| `loading` 63 scope-targets route returns `localCharacters: []` | `routes` 2329, 2350 | The route response for chat and Game scope targets must be an empty `localCharacters` list. |
| `loading` 64 `/local-characters` route registration | `routes` expected route table (32) and its 200 response (2330-2335) | A missing route fails route-table equality and the request. |
| `loading` 65 `/local-characters` loads the trusted subject catalog | `routes` 2336-2339 | The route must return the trusted-catalog family character. |
| `runtime` 13-17 manifest `capabilityApi` is 1.341 | `scripts/validate-catalog.mjs` boundary pin (235-240) and manifest/boundary equality (448-450) | Both pin 1.341 against the same manifest. |
| `browser` 124-128 artifact description names `Chat Settings → Agents → Long-Term Memory` | `scripts/validate-catalog.mjs` activation-guidance equality (551-553) and archived-manifest equality (633-635) | The required guidance (`scripts/catalog-package-guidance.mjs` 140) ends the source description, and the archived manifest must equal it. |

The scope-targets route still asserts that it does not load the trusted subject
catalog: route tests cannot prove that it avoids that work.

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
