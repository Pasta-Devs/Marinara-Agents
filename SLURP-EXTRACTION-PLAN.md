# Noodle To Slurp Extraction Plan

## Purpose

Split the current combined Noodle package into two downloadable Agent packages.

- `noodle` remains the package for the public Noodle social timeline.
- `slurp` becomes the package for the current NoodleR Creator and fan roleplay feed.
- Slurp replaces the NoodleR product name in all new user-visible text.
- This plan does not change the NoodleR product scope. The existing
  `packages/noodle/NOODLER-CONCEPT-BACKLOG.md` remains the product backlog until
  its Slurp-specific work moves into the new package.

This is a large, security-sensitive package split. Do not implement it as one
unreviewable change. Each phase requires its own issue and draft pull request.

## Current State

The current `noodle` feature package combines both products.

- It exposes one Home browser tab, one client capability element, and one
  privileged server route prefix: `/api/noodle`.
- `NoodleView` changes between the public Noodle timeline and NoodleR with a
  local navigation mode.
- `NoodleShell` provides a shared shell, mode switch, asset paths, and visual
  utility code for both products.
- `use-noodle.ts` combines Noodle and NoodleR client hooks and query keys.
- `noodle.routes.ts` combines public timeline and Creator-feed routes.
- `noodle.storage.ts` combines public and Creator-feed persistence behavior.
- The file schema shares `noodle_accounts`, `noodle_posts`, and
  `noodle_interactions`. The `platform` field separates public Noodle accounts
  from NoodleR accounts. NoodleR also uses its own prepared-post, activity,
  reserve, subscription, unlock, and reply-claim tables.
- The Noodle server activation starts the Noodle refresh scheduler, the Creator
  publishing scheduler, and the synthetic fan activity scheduler.
- The feature builder has special handling for the `noodle` package-owned source
  tree, stylesheet build, and the two artwork files.
- Package metadata, README text, locales, catalog text, tests, browser tests,
  and generated outputs use NoodleR names and the single-package model.

## Target State

After the split, a user can install Noodle and Slurp independently.

## Product Boundary Rules

These rules define the split. A code move that breaks one of these rules is not
a valid extraction.

### Noodle rules

Noodle is a local public social timeline.

- Noodle lets the owner select characters, personas, and ambient accounts for a
  public social feed.
- Noodle owns public profiles, posts, replies, likes, reposts, polls, timeline
  notifications, public feed images, generation, and refresh scheduling.
- Noodle may store a Noodle-specific account record for its public timeline.
- Noodle must not create, require, display, or update a Creator profile.
- Noodle must not provide locked posts, subscriptions, simulated prices, unlocks,
  viewer feeds, Creator-only media, synthetic fans, Creator publishing, or
  adult-first Creator guidance.
- Noodle must not show a switch, shortcut, badge, setting, or text for Slurp.
- Noodle owns no Slurp scheduler and makes no Slurp provider request.
- Noodle must start, function, update, and uninstall correctly when Slurp has
  never been installed.

### Slurp rules

Slurp is a local Creator and fan roleplay feed.

- Slurp lets the owner create a Creator profile from an Engine character or an
  Engine persona directly.
- Slurp owns Creator profiles, Creator posts, viewer feeds, follows,
  subscriptions, unlocks, simulated prices, locked-post views, Creator replies,
  media, synthetic fans, onboarding, and Creator automation.
- Slurp uses direct Engine source references in the form of source kind and
  source entity ID. It must not use a Noodle public-account ID as a runtime
  source reference.
- Slurp owns a direct viewer-persona record keyed by the Engine persona ID. It
  must not use a Noodle persona account as a runtime viewer record.
- Slurp keeps its own source snapshot. It handles a deleted character or persona
  without calling Noodle: retain existing content, label the source as missing,
  and stop source-dependent generation until the owner resolves it.
- Slurp keeps Creator identity separate from the Engine source after profile
  creation. Later source name or avatar changes do not change the Creator
  profile.
- Slurp owns all Creator settings and all automation settings under Slurp keys.
  It must not read or write `noodle.settings`.
- Slurp owns its own Home tab, client element, routes, media path, client state,
  database tables, storage adapter, and scheduler lifecycle.
- Slurp owns Slurp request, response, storage, and UI types at its package edge.
  It may use generic Engine types, but it must not expose `NoodleAccount`,
  `NoodleSettings`, or NoodleR-specific shared types as its active data model.
- Slurp must start, function, update, and uninstall correctly when Noodle has
  never been installed.
- Slurp reuses the current NoodleR onboarding structure and user flow. It stores
  onboarding progress only in Slurp state and changes its source selection,
  settings, routes, names, and text to meet these rules.
- A source has at most one Slurp Creator profile. Enforce uniqueness on source
  kind plus source entity ID.
- Slurp copies source identity values into a new Creator profile once. Creator
  name, handle, bio, avatar, banner, and media remain independent after that
  copy.
- A deleted source leaves its Creator profile and posts paused. The owner must
  restore that same source to resume it or create a new Creator profile for a
  different source. The owner cannot relink the existing profile.
- New Creator profiles use a character-aware mix of public and locked posts. The
  mix uses the post concept, Creator settings, and recent feed balance.
- If no Engine persona exists, Slurp shows a read-only owner feed preview. The
  preview does not like, reply, follow, subscribe, unlock, or change read state.

### Shared Engine rules

Noodle and Slurp may both use documented Engine APIs for characters, personas,
connections, galleries, prompt overrides, package routes, package storage, and
the host database. The Engine, not Noodle, is the shared identity source.

The packages may not use each other as an API.

- No route call from Noodle to `/api/slurp` or from Slurp to `/api/noodle`.
- No import from one package source tree into the other package source tree.
- No read or write of the other package's active tables, settings, media files,
  browser storage, query cache, or scheduler state.
- No shared feature shell or two-product navigation.
- A later crossover needs a versioned Engine-owned service contract. It must not
  use a package-private database or route shortcut.

### Confirmed release decisions

- Slurp Creator sources are Engine characters and Engine personas.
- Only Engine personas can view or interact with Slurp posts. Viewer state is
  persona-scoped.
- Slurp starts empty and uses the adapted existing NoodleR onboarding flow.
- Slurp does not import, read, or display existing NoodleR data.
- Existing NoodleR data remains in place as inactive legacy data. It remains
  outside both active package contracts.
- Noodle removes all active NoodleR screens, routes, settings, services, and
  schedulers.
- A missing Creator source keeps its Slurp Creator profile and posts. Slurp stops
  source-dependent generation until the owner repairs or deletes the profile.
- A missing Creator source cannot be relinked to another source. A different
  source requires a new Creator profile.
- Slurp pre-fills Creator identity fields once, then keeps them separate from
  later Engine source changes.
- New Creator profiles use a character-aware public and locked post mix.
- Without an Engine persona, Slurp offers a read-only owner feed preview.
- The first Slurp release has no Noodle or Slurp crossover events.

### Noodle package

- Package id stays `noodle`.
- Noodle owns the public timeline, invited and ambient public accounts, public
  posts and interactions, public image generation, public refresh scheduling,
  and Noodle prompt context.
- Noodle exposes only Noodle UI and only Noodle routes.
- Noodle does not display Slurp navigation, opt-in settings, counts, artwork, or
  product copy.
- Noodle must work when Slurp is absent.

### Slurp package

- Package id is `slurp`.
- Display name is `Slurp`.
- Slurp owns Creator profiles, Creator posts, viewer personas, follows,
  subscriptions, unlocks, Creator replies, Creator media, automatic publishing,
  synthetic audience activity, and Slurp-specific settings.
- Slurp gets its own Home browser tab, capability element, styles, artwork,
  package locale catalog, README, server entry point, route prefix, and package
  source tree.
- Slurp must work when Noodle is absent. It uses Engine characters and personas
  as Creator sources and viewers, not Noodle public accounts.
- Slurp must not add an implicit install, enable, or update dependency on Noodle.

### Cross-product rule

Noodle and Slurp may later exchange intentional roleplay events through a small,
documented Engine capability contract. Neither package may import the other
package's private files, routes, database tables, browser state, or storage
adapter. The initial split must preserve no automatic Noodle/Slurp crossover
behavior unless a separately approved contract implements it.

## Slurp Standalone Changes

The current Creator feed cannot become standalone only by changing names and
moving files. It currently reads the Noodle settings key and treats public
Noodle accounts as both Creator sources and viewer records. These changes are
required before Slurp can meet the product boundary rules.

### Replace Noodle account dependencies

- Replace `noodleAccountId` and `publicAccountId` in active Creator records with
  `sourceKind` and `sourceEntityId`. Store a Slurp-owned immutable source
  snapshot with the Creator profile.
- Resolve the current character or persona from Engine storage for each operation
  that needs live source data. Do not first resolve a Noodle account.
- Create a Slurp viewer record from the Engine persona ID. Put following state,
  unseen state, subscriptions, and unlock links under this Slurp viewer ID.
- Change Creator profile creation, bulk setup, source drafting, avatar handling,
  identity disclosure, profile edits, and source-revision checks to use direct
  Engine character and persona data.
- Change the open-profile image path to use an Engine-owned source image or an
  explicitly copied Slurp asset. Do not proxy an image through Noodle.

### Give Slurp complete local state

- Split the combined Noodle settings schema. Keep public timeline settings in
  `noodle.settings`. Create `slurp.settings` for Creator guidance, onboarding,
  publishing pace, image connections, fan activity, disclosure defaults, and
  other Creator-feed options.
- Move the Creator auto-post schedule, reserve state, fan state, and image
  connection state into Slurp-owned settings and tables.
- Use Slurp-specific tables for Creator profiles, viewer records, posts,
  interactions, subscriptions, unlocks, reply claims, prepared posts, and
  automation state. Use Slurp-specific media directories and URL prefixes.
- Define Slurp request, response, persistence, and UI types. Convert generic
  Engine values only at the Engine API boundary.
- Replace `use-noodle.ts` NoodleR query keys with a Slurp client module rooted at
  `slurp`. Replace all `/noodle/noodler/...` calls with `/slurp/...`.
- Replace the `marinara:noodle:ui` state with a Slurp browser-state key. Do not
  preserve a two-mode navigation state.

### Define source and viewer lifecycle

- A Creator source may be a character or persona without a Noodle profile.
- A viewer must be a persona. Slurp reads the active persona directly from the
  Engine and creates or updates its Slurp viewer record as needed.
- When a source is deleted, Slurp preserves its Creator profile and existing
  posts. It disables automatic generation and gives the owner a repair or delete
  action.
- When a viewer persona is deleted, Slurp removes or retires only that viewer's
  follows, subscriptions, unlocks, and read state. It does not change Creator
  profiles or posts.
- Synthetic fans are Slurp-local identities. They must not be Noodle accounts or
  add data to Noodle tables.

### Preserve legacy NoodleR data without use

The split does not import NoodleR data into Slurp. Existing NoodleR data remains
in place as inactive legacy data.

- Slurp must not define an importer for former NoodleR tables, settings, media,
  browser state, or routes.
- Slurp starts empty. Its onboarding creates new Slurp state only.
- Noodle must stop reading, writing, displaying, scheduling, or serving NoodleR
  data after the split.
- Do not let Noodle or Slurp read, display, modify, or delete the inactive legacy
  records, settings, media, or browser state.
- Leave those legacy files and records in place. Normal Engine backup and storage
  retention rules remain responsible for them.
- Do not offer a read-only view, conversion action, or compatibility mode.

## Decisions Required Before Code

Resolve these decisions in the split issue before implementation begins.

1. Confirm the first Slurp version and the exact supported Marinara Engine range.
   Start from the existing `>=2.4.2 <4.0.0` only after the new package proves
   that it uses no newer Engine contract.
2. Confirm the Slurp Home tab label, aria label, icon, and all supported locales.
   The new package must not publish NoodleR branding as an alias unless there is
   an approved historical compatibility reason.
3. Confirm the uninstall policy. The default recommendation is that uninstalling
   Slurp stops Slurp routes and schedulers but follows Engine package-storage
   retention behavior. It must not delete Noodle data. Uninstalling Noodle must
   not delete or corrupt Slurp data.
4. Confirm whether a temporary NoodleR-to-Slurp notice is needed. Prefer no
   compatibility UI inside Noodle. Use package release notes or Engine-owned
   package documentation when a notice is required.

## Package Boundary

### Move to Noodle

- Public-only components: `NoodleHome`, `NoodlePostCard`, public profile
  surfaces, polls, public image composition, and Noodle date/time utilities that
  only support public timeline behavior.
- Public hooks, query keys, navigation state, package browser state, route
  handlers, storage methods, prompt generation, image generation, refresh
  scheduler, refresh diagnostics, and public schema tables.
- Only `noodle-klusek.png`, Noodle metadata, and Noodle documentation.

### Move to Slurp

- All `Noodler*` components and hooks.
- Creator profile drafting, profile management, Creator posts, locked-post view,
  viewer feeds, follows, subscriptions, unlocks, comments, Creator replies,
  age gate, bulk Creator setup, publishing settings, media, automatic publishing,
  fan activity, disclosure, source snapshots, and reserve logic.
- Slurp client state, route handlers, storage methods, generation services,
  Creator publishing scheduler, and fan activity scheduler.
- The current `noodler-klusek.png` must be renamed to a Slurp asset name. Do not
  retain a Noodler-named runtime asset in the final package.

### Extract or duplicate only after review

The current shared shell and shared storage are not a valid final boundary.

- Split UI utilities by ownership. Move generic, package-safe utilities into a
  small shared source module only when both packages need the same code and the
  module has no product state, product routes, or package asset paths.
- Give each package its own shell and navigation model. Remove the two-mode
  switch from both packages.
- Split `use-noodle.ts` into Noodle and Slurp hook modules. Each module must use
  its own query-key root and own API prefix.
- Split storage into separate Noodle and Slurp adapters. Do not leave one package
  as the other package's data access layer.
- Reuse Engine-owned types and public capability APIs. Do not create a private
  source import from one package into the other.

## Data Ownership Design

The current shared tables make data separation the critical phase. Slurp starts
with new data. It does not import legacy NoodleR records.

### New Slurp ownership

Create Slurp-owned schema definitions and storage paths for:

- Creator profiles with direct Engine source kind and source entity ID fields.
- Viewer records keyed by Engine persona ID.
- Creator posts and post metadata.
- Creator interactions and Creator reply claims.
- Viewer follows, subscriptions, and post unlocks.
- Prepared posts, automatic attempts, reserve state, and fan activity state.
- Slurp media and avatar files.
- Slurp settings, source snapshots, onboarding state, and local browser state.

Use Slurp-specific table and storage names. Do not keep `noodle_*` names for new
Slurp data. Do not create active Slurp references to legacy NoodleR IDs.

### Legacy data isolation requirements

1. Slurp activation must not query, copy, update, or delete legacy NoodleR data.
2. Noodle activation must not query, update, or delete legacy NoodleR data.
3. New Slurp creation must use only Engine character and persona IDs plus
   Slurp-owned IDs.
4. Legacy NoodleR media paths must stay untouched. Slurp must write new media
   only to Slurp paths.
5. No route, UI state, scheduler, prompt, or database relation may bridge active
   Slurp state to inactive legacy NoodleR state.

### Independent lifecycle rules

- Slurp installation creates Slurp state only. It must not modify public Noodle
  accounts, posts, interactions, refresh history, settings, or legacy NoodleR
  data.
- Noodle installation or update must not run Slurp or NoodleR conversion code.
- Noodle activation starts only the public refresh scheduler.
- Slurp activation starts only the Creator publishing and fan activity schedulers.
- Each cleanup function stops only its own scheduler, service registration,
  routes, and browser capability.
- Both install orders must work: Noodle then Slurp, Slurp then Noodle, and Slurp
  alone.

## Delivery Phases

### Phase 0: Inventory and contract tests

- Open the split issue and record all decisions above.
- Make a machine-readable inventory of current NoodleR routes, schema tables,
  media paths, settings keys, browser storage keys, schedulers, services,
  localized strings, artifacts, and tests.
- Add focused tests that document the active NoodleR data graph, access rules,
  and all places that must become inactive legacy data.
- Mark each source file as Noodle, Slurp, shared, or obsolete.
- Confirm the Engine storage-retention boundary before any package source is
  disabled. Legacy NoodleR files and records stay in their existing locations.
- Do not change user behavior in this phase.

Proof: the inventory maps every active NoodleR route and persisted record to a
Slurp owner or to inactive legacy data. The test suite gives a baseline before
extraction. The retention boundary has an owner, a location, and a rule that
active packages cannot access legacy NoodleR data.

### Phase 1: Builder support for two package-owned feature trees

- Generalize the Noodle-specific feature-builder branch without changing emitted
  Noodle output.
- Define separate `noodle` and `slurp` feature definitions, source roots, owned
  source paths, stylesheet entry handling, client custom-element tags, assets,
  metadata, and Home contributions.
- Add a Slurp package skeleton with manifest inputs, agent definition inputs,
  locale source, README, client entry, server entry, and artwork source.
- Keep generated `client.js`, `server.mjs`, manifests, artifacts, catalogs,
  checksums, and byte sizes builder-owned.

Proof: a focused build can build Noodle unchanged and can build a minimal Slurp
package. Both packages appear once in every compatible catalog lane.

### Phase 2: Make Slurp data and identity standalone

- Define the Slurp account, viewer, post, interaction, subscription, unlock,
  automation, and settings schemas.
- Replace every runtime Noodle-account lookup in Creator and viewer behavior with
  a direct Engine character or persona lookup plus Slurp-owned state.
- Reuse the existing onboarding sequence, including its age gate, Easy and
  Customize paths, activity choices, completion state, and optional first-post
  flow. Replace NoodleR names, settings, routes, and copy with Slurp behavior.
- Make onboarding source selection explicit. The owner selects a character or
  persona for the first Creator profile. Do not create a Creator automatically.
- Prefill Creator identity fields from that source once. Save the fields as
  Slurp-owned values before allowing edits.
- Enforce one Creator profile per source with a unique source kind/entity ID
  constraint and a concurrent-create test.
- Add the no-persona owner preview. It is read-only and cannot change feed,
  social, access, subscription, unlock, or read state.
- Use the character-aware public and locked access policy for new Creator posts.
  Do not replace it with a fixed percentage.
- Define Slurp-specific route and UI contracts. Restrict NoodleR contracts to
  inactive legacy data and remove them from active Slurp code.
- Define source-deletion, source-restore, and viewer-deletion behavior before
  moving routes or UI. A deleted source cannot be relinked to a different source.

Proof: focused service tests create and use Slurp Creator profiles and viewers
with no Noodle account records. Slurp-owned settings changes do not write
`noodle.settings`, and Slurp does not query legacy NoodleR tables.

### Phase 3: Extract the Slurp client surface

- Move NoodleR UI, UI locale keys, hooks, query keys, and browser state into
  `packages/slurp/src/engine`.
- Rename component, element, state, CSS, route, and asset identifiers from
  NoodleR/Noodler to Slurp where the identifier is not retained only for legacy
  inactive-data documentation.
- Replace the mode switch with a Slurp-only shell and Slurp navigation model.
- Remove every Slurp control, notification count, entry path, and product string
  from the Noodle client.
- Give Slurp its own API client prefix and media URL handling.

Proof: Noodle browser tests do not load Slurp code or show Slurp controls. Slurp
browser tests open its own Home tab and complete onboarding, profile creation,
viewing, access, and settings flows without Noodle installed.

### Phase 4: Extract Slurp server behavior and persistence

- Move Creator routes into a Slurp route module at `/api/slurp`.
- Move Creator services and the two Slurp schedulers into the Slurp source tree.
- Create Slurp storage and schema definitions.
- Remove Creator route registration, service registration, and scheduler startup
  from Noodle activation.
- Reduce Noodle storage, schema imports, and routes to public timeline behavior.
- Replace all package-private dependencies with Engine public APIs or Slurp-owned
  implementations.

Proof: activation self-checks pass independently. Noodle serves only `/api/noodle`
behavior. Slurp serves only `/api/slurp` behavior. Neither package needs the
other package to activate.

### Phase 5: Prove legacy data isolation

- Add fixtures that include legacy NoodleR tables, settings, media paths, and
  browser state alongside fresh Slurp state.
- Leave the legacy fixture in its original Engine storage and verify its records,
  media, and browser state are not modified.
- Prove Slurp activation and onboarding do not read or modify legacy NoodleR
  records.
- Prove Noodle activation removes NoodleR behavior without modifying legacy
  NoodleR records.
- Test authorization and access matrices for new public, locked, subscribed, and
  unlocked Slurp posts.

Proof: a profile with legacy NoodleR data opens Slurp empty. New Slurp state and
Noodle public state work independently. The legacy data remains in its original
storage and is inaccessible to both active packages.

### Phase 6: Product metadata and documentation

- Update both package manifests, English package locales, translated metadata,
  README catalog rows, package READMEs, and linked Engine documentation.
- Move and adapt the current NoodleR concept backlog to `packages/slurp/`.
- Update user-visible copy from NoodleR to Slurp. Keep legacy NoodleR wording
  only in inactive-data and historical-release documentation.
- State that Slurp is a fresh, independent product and does not import NoodleR
  data. Add a clear install, update, restart, uninstall, storage, provider, and
  simulated-access description for each package.

Proof: `node scripts/validate-package-locales.mjs` passes. Documentation names
the two packages correctly and does not claim that one package provides both.

### Phase 7: Build, manual test, and release review

- Rebuild the narrow package set with
  `node scripts/build-feature-packages.mjs noodle slurp`.
- Review generated package payloads, ZIP contents, artifacts, and every catalog
  lane as outputs of the builder.
- Install and update packages in a compatible Marinara Engine checkout for all
  supported installation orders.
- Verify restart, offline restart, uninstall, reinstall, and update behavior.
- Open a draft PR to `staging`. Keep it draft until validation and self-review
  complete.

Proof: validation passes and the PR states the exact installation and isolation
paths tested. Do not mark a manual proof item complete until a human runs it.

## Required Automated Validation

Run these commands after the final package build:

```sh
node scripts/test-catalog-lanes.mjs
node scripts/validate-package-locales.mjs
node scripts/validate-catalog.mjs
git diff --check
```

Run focused regression tests for Noodle and Slurp. Replace the current
NoodleR-specific test paths and names with Slurp ownership. Keep public Noodle
tests separate from Slurp tests. Run the package browser tests for both packages
after adding a Slurp browser suite.

The split also requires isolation tests that prove these cases:

- Existing NoodleR state remains unchanged and inactive in its original storage.
- Slurp activation and onboarding do not query or modify legacy NoodleR state.
- Missing or malformed legacy data does not block fresh Slurp activation.
- Creator media remains accessible only through Slurp access rules.
- Noodle public data does not change during Slurp installation or use.
- No Engine persona shows an owner read-only preview with mutating controls.
- A source change does not overwrite independent Creator identity fields.
- A deleted source pauses its profile and cannot be relinked to another source.
- One source cannot create two Creator profiles under concurrent requests.
- New Creator posts use the character-aware public and locked access policy.
- Noodle works without Slurp.
- Slurp works without Noodle.
- Uninstalling either package does not stop or alter the other package.
- Noodle and Slurp schedulers do not start twice after install, update, or restart.

## Manual Validation Matrix

Test each row in a compatible Engine checkout and record the result in the PR.

| Installed packages before update | Action | Required result |
| --- | --- | --- |
| Legacy combined Noodle | Update Noodle, install Slurp, restart | Noodle public data stays visible. Slurp starts empty. Legacy NoodleR data stays in its original storage and is not shown. |
| Legacy combined Noodle | Update Noodle only, restart | Noodle works. Legacy NoodleR data stays in its original storage and is not shown by Noodle. |
| No packages | Install Noodle | Only Noodle Home tab and public timeline appear. |
| No packages | Install Slurp | Only Slurp Home tab and Creator feed appear. |
| Noodle installed | Install Slurp | Both tabs work. No duplicate scheduler runs occur. |
| Slurp installed | Install Noodle | Both tabs work. Slurp state stays unchanged. |
| Both installed | Uninstall Noodle, restart | Slurp remains usable. |
| Both installed | Uninstall Slurp, restart | Noodle remains usable. |
| Both installed | Offline restart | Each installed package loads its stored data without network access. |

## Non-Goals

- Do not combine this split with new Creator-feed features from the concept
  backlog.
- Do not change adult-content policy, prices, access rules, or generation prompts
  except where the package boundary requires a route or storage name change.
- Do not import, display, modify, or delete legacy NoodleR data.
- Do not retain a hidden Slurp view inside Noodle as a compatibility shortcut.
- Do not hand-edit generated bundles, manifests, catalogs, checksums, byte sizes,
  or ZIP artifacts.

## Completion Criteria

The work completes only when all items below are true.

- Noodle and Slurp are separate, valid, downloadable catalog packages.
- Each package has its own source tree, client capability, server activation,
  routes, browser state, assets, metadata, documentation, artifact, and catalog
  entry.
- Neither package imports private source or calls private routes from the other.
- Noodle has no NoodleR or Slurp user interface or runtime behavior.
- Slurp has no hidden requirement that Noodle is installed.
- Existing NoodleR data remains inactive and unchanged.
- Noodle public data remains intact through Slurp install, update,
  restart, uninstall, and reinstall paths.
- All required automated checks pass.
- The PR includes exact manual proof and any remaining proof gaps.
