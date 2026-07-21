# Capability integration tests

`spatial-context.e2e.ts` is the Hierarchical Maps package's browser integration suite. It was moved with the feature so the lightweight Engine smoke suite does not require optional routes or UI to exist.

Run it against a Marinara Engine checkout that has the local Hierarchical Maps package installed and active, using the Engine Playwright configuration:

```bash
cd ../Marinara-Engine
pnpm exec playwright test ../Marinara-Agents/tests/spatial-context.e2e.ts -c playwright.config.ts
```

The package must be installed in the test data directory before launching the Playwright web server.

## Pasta Phone shell

`pasta-phone-shell.e2e.mjs` drives the built `packages/pasta-phone/client.js` in a
page carrying the Engine's real theme tokens: it opens the bottom sheet, taps all
four apps, navigates back, and closes with Escape, across both installed visual
themes, light and dark, and a mobile viewport. It needs only a built client bundle
and an Engine checkout for the stylesheets — no server, database, or installed
package, because the shell is client-only preview UI.

```bash
MARINARA_ENGINE_ROOT=../Marinara-Engine node tests/pasta-phone-shell.e2e.mjs
```

It also guards the constraint that shaped the package: the Engine only emits
Tailwind utilities listed in its `capability-package-safelist.html`, so the phone
styles itself through a package-owned `<style>` block instead. The layout
assertions fail if that block stops being applied.

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
