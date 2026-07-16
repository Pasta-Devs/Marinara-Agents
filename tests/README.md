# Capability integration tests

`spatial-context.e2e.ts` is the Hierarchical Maps package's browser integration suite. It was moved with the feature so the lightweight Engine smoke suite does not require optional routes or UI to exist.

Run it against a Marinara Engine checkout that has the local Hierarchical Maps package installed and active, using the Engine Playwright configuration:

```bash
cd ../Marinara-Engine
pnpm exec playwright test ../Marinara-Agents/tests/spatial-context.e2e.ts -c playwright.config.ts
```

The package must be installed in the test data directory before launching the Playwright web server.

## Exact-artifact lifecycle regression

`hierarchical-maps-lifecycle.regression.ts` installs the immutable Maps 1.0.5
artifact through an isolated catalog, updates through 1.0.6 to the exact 1.1.0 artifact,
then proves reviewed existing-campaign Game map reconciliation, offline restart,
uninstall, reinstall, full-backup creation, and full-backup restore without
deleting the stored definition or spatial snapshot.

Run it with the Engine server toolchain so the package is exercised against the
real host runtime:

```bash
cd ../Marinara-Engine
pnpm --filter @marinara-engine/server exec tsx ../Marinara-Agents/tests/hierarchical-maps-lifecycle.regression.ts
```
