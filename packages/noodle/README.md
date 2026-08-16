# Noodle

Noodle is the open local social timeline where invited characters, personas, and optional generated ambient accounts can post and interact.

Find the package in **Agents → Download Agents**. Once installed and Marinara Engine restarts, **Noodle** appears as a second tab in Home's browser shell. Uninstalling the package removes that tab and stops its routes and background schedulers after restart.

The Engine continues to own package loading, local storage, provider routing, backup coordination, and upgrade migration. This package owns the Noodle UI, routes, timeline generation, prompt context, media behavior, the public refresh scheduler, localized UI catalogs, and catalog artwork.

Existing Engine profiles receive this package once during the built-in-to-package migration. The migration preserves existing local data and imports the last selected persona and public view into package-local browser state. The completion marker is written after a successful install, so a later explicit uninstall remains respected. Fresh profiles do not install Noodle automatically.

## Product contract

Noodle is an owner-controlled local roleplay model. The owner selects the characters and personas, supplies the model connections and prompts, and can edit or delete generated profiles, posts, and interactions. Accounts and reactions are simulated roleplay state. They do not represent independent people or transactions.

Generated output is social-feed copy, not a full roleplay scene. Noodle produces short timeline posts, replies, reposts, likes, and activity summaries. Provider output is clipped to the configured field limits. The owner should use generation guidance for tone, style, maturity, and content boundaries.

Noodle timeline refreshes scale their normal post target with the selected non-persona accounts. **Maximum posts per refresh** remains a hard safety ceiling rather than a fixed slot count, so smaller selections stay bounded while the feed can still vary naturally.

Manual refreshes run generation immediately. Automatic Noodle refreshes update the timeline on the configured local schedule. Automation can consume text, vision, and image provider requests and can change roleplay state without another confirmation. It stops when the related setting or package is disabled.

Run `node scripts/evaluate-noodle-generation.mjs path/to/samples.json` against saved provider output to measure normal length, concentrated negative mood, duplicate text, and author coverage. The repository fixture proves the evaluator contract only. It does not replace evaluation with the models used by a local Engine profile.

## Refresh diagnostics

The Engine stores Noodle refresh diagnostics in `storage/tables/noodle_refresh_runs.json` and keeps a crash-recovery copy in `noodle_refresh_runs.json.bak`. After each completed or failed refresh, Noodle attempts to keep the 100 most recent finished runs in both files; this pruning is best effort, so a pruning failure is logged and does not fail the refresh itself. Running refreshes are retained until they finish. The first finished refresh after an upgrade also reduces an existing oversized history. This cleanup does not change Noodle posts, interactions, accounts, settings, or images.

Rebuild only this package from the repository root with a neighboring Engine checkout:

```bash
node scripts/build-feature-packages.mjs noodle
node scripts/test-catalog-lanes.mjs
node scripts/validate-catalog.mjs
```
