# Noodle

Noodle packages the existing Noodle public timeline and private NoodleR creator platform without redesigning either interface. Find it in **Agents → Download Agents**. Once installed and Marinara Engine restarts, **Noodle** appears as a second tab in Home's browser shell. Uninstalling the package removes that tab and stops its routes and background schedulers after restart.

The Engine continues to own package loading, local storage, provider routing, backup coordination, and upgrade migration. This package owns the Noodle UI, routes, timeline generation, prompt context, media behavior, schedulers, localized UI catalogs, catalog artwork, and the familiar Noodle/NoodleR logo pair used by both the interface and its Home tab.

Existing Engine profiles receive this package once during the built-in-to-package migration. The migration preserves Noodle/NoodleR tables and imports the last selected persona and view into package-local browser state. The completion marker is written after a successful install, so a later explicit uninstall remains respected. Fresh profiles do not install Noodle automatically.

Rebuild only this package from the repository root with a neighboring Engine checkout:

```bash
node scripts/build-feature-packages.mjs noodle
```
