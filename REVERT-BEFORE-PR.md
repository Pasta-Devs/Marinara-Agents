# ⚠️ REVERT BEFORE MERGING TO main

## catalog/catalog.json — artifact/icon URLs repointed to `hold-the-phone`

To let ME on this branch install quest 1.0.4 (and others) before the artifacts
land on `main`, all URLs in **`catalog/catalog.json`, `catalog/v2/catalog.json`,
and `catalog/v3/catalog.json`** were changed (prod reads v3):

    /Pasta-Devs/Marinara-Agents/main/  ->  /Pasta-Devs/Marinara-Agents/hold-the-phone/

### Before the PR / merge to main
1. Revert the URLs back to `.../main/` (one find-replace, opposite direction).
2. Confirm every advertised artifact (e.g. `artifacts/quest-1.0.4.zip`) actually
   exists on `main` — that was the original bug: catalog advertised 1.0.4 but
   `main` only had quest up to 1.0.3, so the download 404'd.

## Audit: what changed vs `main` (verify each is intentional before PR)

Checked all `packages/*/manifest.json` and `catalog/catalog.json` against
`origin/main`. **No packages or catalog entries were deleted/dropped.** These
are the only diffs — confirm each is intended and that the matching
`artifacts/<pkg>-<version>.zip` exists on `main` after merge:

- [ ] hierarchical-maps  1.3.1 → **1.3.3**
- [ ] long-term-memory   1.1.6 → **1.2.3**
- [ ] quest              1.0.3 → **1.0.4**
- [ ] virtual-phone      (new) → **2.4.0**

After merging `origin/staging` (035b803) the catalogs came back pointing at `main`
again, and were repointed wholesale a second time. Expect to redo this after every
merge from staging, or after any catalog rebuild — the builder hardcodes `main`.
Noodle 1.0.0, World Maps 1.3.4 and Long-Term Memory 1.2.4 arrived with that merge
and are advertised from this branch too; every advertised artifact was checked to
exist in this branch's tree.

Everything else matches `main` exactly.

Delete this file once done.
