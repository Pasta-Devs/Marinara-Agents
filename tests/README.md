# Capability integration tests

`spatial-context.e2e.ts` is the Hierarchical Maps package's browser integration suite. It was moved with the feature so the lightweight Engine smoke suite does not require optional routes or UI to exist.

Run it against a Marinara Engine checkout that has the local Hierarchical Maps package installed and active, using the Engine Playwright configuration:

```bash
cd ../Marinara-Engine
pnpm exec playwright test ../Marinara-Agents/tests/spatial-context.e2e.ts -c playwright.config.ts
```

The package must be installed in the test data directory before launching the Playwright web server.

`long-term-memory-storage.regression.ts` proves stable-root restart persistence,
committed transaction recovery, strict malformed-settings self-check failure,
retention cleanup, and canonical-note preservation:

```bash
cd ../Marinara-Engine
pnpm --filter @marinara-engine/server exec tsx "$PWD/../Marinara-Agents/tests/long-term-memory-storage.regression.ts"
```

`long-term-memory-runtime.regression.ts` proves keyword-only package recall,
scope filtering, empty recall, malformed-index recovery, receipt idempotence,
null-receipt regeneration accounting, deterministic finalized-turn capture,
continuation and regeneration-swipe handling, and service activation cleanup:

```bash
cd ../Marinara-Engine
pnpm --filter @marinara-engine/server exec tsx "$PWD/../Marinara-Agents/tests/long-term-memory-runtime.regression.ts"
```

`long-term-memory-routes.regression.ts` proves the real Engine privileged guard,
package-owned settings, note creation/listing, search, and route cleanup:

```bash
cd ../Marinara-Engine
MARINARA_ENGINE_ROOT=/tmp/opencode/marinara-engine-ltm-host pnpm --filter @marinara-engine/server exec tsx "$PWD/../Marinara-Agents/tests/long-term-memory-routes.regression.ts"
```

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

`long-term-memory-lifecycle.regression.ts` installs the current generated LTM
artifact, proves offline activation and restart, includes the durable vault in
full backup, and verifies uninstall/reinstall preserves the vault byte-for-byte:

```bash
cd ../Marinara-Engine
MARINARA_ENGINE_ROOT=/tmp/opencode/marinara-engine-ltm-host pnpm --filter @marinara-engine/server exec tsx ../Marinara-Agents/tests/long-term-memory-lifecycle.regression.ts
```
