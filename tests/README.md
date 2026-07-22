# Capability integration tests

`spatial-context.e2e.ts` is the Hierarchical Maps package's browser integration suite. It was moved with the feature so the lightweight Engine smoke suite does not require optional routes or UI to exist.

Run it against a Marinara Engine checkout that has the local Hierarchical Maps package installed and active, using the Engine Playwright configuration:

```bash
cd ../Marinara-Engine
pnpm exec playwright test ../Marinara-Agents/tests/spatial-context.e2e.ts -c playwright.config.ts
```

The package must be installed in the test data directory before launching the Playwright web server.

`long-term-memory.e2e.ts` is a package-local browser smoke suite for the
installed Long-Term Memory UI. It expects a provisioned running Engine and the
locally rebuilt package to already be installed and active:

```bash
cd ../Marinara-Engine
MARINARA_ENGINE_ROOT="$PWD" pnpm exec playwright test -c ../Marinara-Agents/tests/long-term-memory.playwright.config.ts
```

The storage, extraction graph, runtime, and debug-log regressions cover
persistence, extraction, recall/index recovery, and debug logging:

```bash
cd ../Marinara-Engine
for test in storage extraction-graph runtime debug-log; do
  pnpm --filter @marinara-engine/server exec tsx \
    "$PWD/../Marinara-Agents/tests/long-term-memory-${test}.regression.ts"
done
```

`long-term-memory-routes.regression.ts` proves the real Engine privileged guard,
package-owned settings, note creation/listing, search, and route cleanup:

```bash
cd ../Marinara-Engine
MARINARA_ENGINE_ROOT="$PWD" pnpm --filter @marinara-engine/server exec tsx "$PWD/../Marinara-Agents/tests/long-term-memory-routes.regression.ts"
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

`long-term-memory-lifecycle.regression.ts` installs immutable LTM `1.0.16`,
populates its vault and legacy index state, updates to the generated `1.0.17`
artifact, then proves offline activation, backup inclusion, uninstall/reinstall,
and durable vault preservation:

```bash
cd ../Marinara-Engine
MARINARA_ENGINE_ROOT="$PWD" pnpm --filter @marinara-engine/server exec tsx ../Marinara-Agents/tests/long-term-memory-lifecycle.regression.ts
```
