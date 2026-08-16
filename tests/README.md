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
 for test in storage extraction-graph extraction-reliability runtime routes conversation-summary-import debug-log lifecycle; do
  MARINARA_ENGINE_ROOT="$PWD" pnpm --filter @marinara-engine/server exec tsx \
    "$PWD/../Marinara-Agents/tests/long-term-memory-${test}.regression.ts"
done
node "$PWD/../Marinara-Agents/tests/long-term-memory-feedback-clarity-ui.regression.mjs"
node "$PWD/../Marinara-Agents/tests/long-term-memory-chat-settings-ui.regression.mjs"
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
