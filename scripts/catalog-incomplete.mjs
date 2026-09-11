// Packages that exist in this repository but are not ready to be listed to
// every user yet. Two tiers, because "not finished" and "not promoted" are
// different states:
//
// INCOMPLETE_PACKAGE_IDS — hidden from EVERY channel. The package keeps
// building (payload, manifest, artifact, and locales stay in the tree so
// development and testing continue) but appears in no published catalog at
// all. Use while a package is still being built and is not ready for anyone.
//
// STAGING_ONLY_PACKAGE_IDS — visible to Engine `staging` users, hidden from
// stable `main` users. Use once a package is ready for testers but not for the
// stable channel.
//
// The staging tier exists because promotion is a wholesale `staging` -> `main`
// merge: both branches end up with byte-identical catalogs, so a package
// cannot be hidden on one branch and shown on the other by catalog CONTENT.
// Only the Engine knows which channel it is on. So a staging-only package is
// cut from the published lanes (which stable users read, and which promotion
// copies verbatim) and emitted into a PREVIEW OVERLAY under catalog/preview/
// instead. The overlay rides along on `main` inertly: stable Engines never
// request it. Staging Engines fetch it and merge it over the published lanes.
//
// Fail-hidden, never fail-leak: an Engine that does not know about the overlay
// (every release before preview-overlay support) simply never sees the package,
// which is the safe direction. Nothing is ever revealed to stable users by an
// Engine that is behind.
//
// Delete an id from its set — and rebuild the catalog — when the package
// graduates. Promotion path: INCOMPLETE_PACKAGE_IDS -> STAGING_ONLY_PACKAGE_IDS
// -> neither.
//
// Enforcement lives at the single catalog chokepoint (writeCatalogFamily in
// catalog-lanes.mjs), so every builder inherits both tiers, and a stale
// committed entry for a newly-marked id is dropped by whichever builder runs
// next. validate-catalog.mjs asserts each tier lands in the right place.
//
// Dev escape hatch: MARINARA_CATALOG_INCLUDE_INCOMPLETE=1 publishes everything
// into the normal lanes for a local build, so an unfiltered catalog can be
// served to a development Engine through its MARINARA_AGENT_CATALOG_URL
// override. Never commit a catalog generated that way — validation rejects it.
export const INCOMPLETE_PACKAGE_IDS = new Set(["pixelforge"]);

export const STAGING_ONLY_PACKAGE_IDS = new Set(["gacha-forge"]);

// A package is in exactly one state. Both sets hiding the same id would make
// the published/overlay split order-dependent, so reject it at import time.
for (const id of STAGING_ONLY_PACKAGE_IDS) {
  if (INCOMPLETE_PACKAGE_IDS.has(id)) {
    throw new Error(
      `${id} cannot be both incomplete and staging-only — pick one tier in scripts/catalog-incomplete.mjs`,
    );
  }
}
