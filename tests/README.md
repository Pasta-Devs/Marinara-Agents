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
privileged routes, debug logging, and the exact release artifact lifecycle:

```bash
cd ../Marinara-Engine
 set -e
for test in storage extraction-graph extraction-reliability runtime routes-notes routes-imports routes-drafts routes-scope-identity routes-backup routes conversation-summary-import debug-log browser installation lifecycle local-characters scope-targets scope-fallback-labels source-task index-keys; do
  MARINARA_ENGINE_ROOT="$PWD" pnpm --filter @marinara-engine/server exec tsx \
    "$PWD/../Marinara-Agents/tests/long-term-memory-${test}.regression.ts"
done
 node "$PWD/../Marinara-Agents/tests/long-term-memory-loading.regression.mjs"
node "$PWD/../Marinara-Agents/tests/long-term-memory-feedback-clarity-ui.regression.mjs"
```

The completion watchdog proof is a direct Node test:

```bash
node "$PWD/../Marinara-Agents/tests/regression-helpers.regression.mjs"
```

The lifecycle fixture compiles Engine's `globals.css` with Engine's installed
Vite and Tailwind plugin before launching Chromium. Use that fixture for visual
review evidence; serving `globals.css` directly leaves Tailwind directives
unprocessed and is not a valid visual pass.

New standalone package browser fixtures should reuse
`compileEngineVisualStyles()` from `engine-visual-styles.ts` and include their
package client source glob. The helper fails if Tailwind directives remain in
the served CSS, preventing raw-stylesheet screenshots from being accepted as
visual evidence.

Set `MARINARA_VISUAL_OUTPUT_DIR` to capture compiled-style mobile and desktop
review queue screenshots while running the lifecycle fixture:

```bash
MARINARA_ENGINE_ROOT="$PWD" MARINARA_VISUAL_OUTPUT_DIR=/tmp/marinara-visuals \
  pnpm --filter @marinara-engine/server exec tsx \
  "$PWD/../Marinara-Agents/tests/long-term-memory-lifecycle.regression.ts"
```

## Long-Term Memory test ownership

Choose the narrowest layer that exercises a contract. Similar assertions at
different boundaries are not duplicates: remove one only when the surviving
check exercises the same inputs and cannot pass while the removed check fails.

| Layer | Owning suites (`long-term-memory-*.regression.*`) | Contracts |
| --- | --- | --- |
| Direct services | `storage`, `runtime`, `extraction-graph`, `extraction-reliability`, `conversation-summary-import` | Storage recovery/quarantine, lineage-safe retraction, draft dependencies, activity persistence, retrieval lanes and scope, receipt idempotency/redaction, extraction graph validation, identity/dedup boundaries, import invariants |
| Focused helpers | `index-keys`, `local-characters`, `scope-targets`, `scope-fallback-labels`, `source-task`, `debug-log` | Unsafe keys, local identity isolation, scope selection/labels, task cancellation, debug persistence |
| HTTP integration | `routes-notes`, `routes-imports`, `routes-drafts`, `routes-scope-identity`, `routes-backup`, and the direct `routes` scenario | Auth/permissions, validation, statuses and client-consumed errors, request-to-service and response-to-persistence mapping, scope translation, applied mutation IDs, preflight, cancellation, backup semantics |
| Browser | `browser`, `loading`, `feedback-clarity-ui` | Visible workflows, request construction, response consumption, archive undo/partial failure, review/re-extraction, activation, loading and layout; retain explicit static contracts where behavioral proof is absent |
| Installation | `installation` | Exact ZIP install, offline restart, full-backup inclusion, uninstall/reinstall and durable-byte preservation; `lifecycle` runs browser plus installation |
| Repository integrity | `node scripts/validate-catalog.mjs` | Manifest-derived lanes and legacy alias, catalog/manifest agreement, artifact URLs, hashes, sizes, archive contents and package contracts |

The split route entrypoints share `long-term-memory-routes.regression.ts` but
run in separate processes. Its direct `all` scenario also contains unique
checks; do not remove it as a redundant aggregator. Browser API responses are
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
