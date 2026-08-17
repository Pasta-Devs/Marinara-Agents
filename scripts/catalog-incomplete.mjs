// Packages that exist in this repository but are not ready for users yet.
//
// An id listed here keeps building normally — its payload, manifest, artifact,
// and locales stay in the tree so development and testing continue — but the
// package is EXCLUDED from every generated catalog lane, which is the only
// surface Marinara Engine users browse and install from (on both the `main`
// and `staging` Engine channels, since each reads its matching branch's
// catalog). This is deliberately different from the nonDownloadableCoreFeatures
// scrub (a core feature that must never ship as a package): an incomplete
// package is expected to ship eventually. Delete its id from this set — and
// rebuild the catalog — when it is ready to be listed.
//
// Enforcement lives at the single catalog chokepoint (writeCatalogFamily in
// catalog-lanes.mjs), so every builder inherits the exclusion and a stale
// committed entry for a newly-marked id is dropped by whichever builder runs
// next. validate-catalog.mjs asserts these ids are absent from the published
// catalog and exempts them from the guidance-coverage exactness check, so
// activation guidance may be authored ahead of the listing.
//
// Dev escape hatch: MARINARA_CATALOG_INCLUDE_INCOMPLETE=1 skips the exclusion
// for a local build, so an unfiltered catalog can be served to a development
// Engine through its MARINARA_AGENT_CATALOG_URL override. Never commit a
// catalog generated that way — validate-catalog.mjs will reject it.
export const INCOMPLETE_PACKAGE_IDS = new Set(["pixelforge"]);
