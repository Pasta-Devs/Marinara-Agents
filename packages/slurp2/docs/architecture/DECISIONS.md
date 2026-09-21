# Slurp2 architecture decisions

Append-only. Add new entries at the bottom. Each entry states the date, problem, decision, affected
modules, rejected alternative, and migration consequence.

## 2026-09-18 — Feature-first `slp` namespace

- **Problem:** Slurp2 grew from legacy Noodle/Slurp code into five very large route, storage, hook,
  and UI files plus a flat service directory. Cross-feature coupling was implicit, and new features
  had no clear place or extension seam.
- **Decision:** Move Slurp2 into package-owned `client/src/slp`, `server/src/slp`, and a narrow
  `shared/src/slp`. Organise each root as base → reusable modules (client) → features → app or
  workflows → entry. Features talk to each other only through `slp-<name>-contract.ts` files.
  Platform events reach other features through pure typed modifiers. `api-client.ts` and Garnish
  remain named exceptions. Rules are enforced by `tests/slurp2-architecture.regression.ts`.
- **Affected modules:** all Slurp2 source; `scripts/build-feature-packages.mjs` ownership;
  `scripts/typecheck-packages.mjs`; Slurp2 source-reading tests.
- **Rejected alternative:** keeping code in Engine technical folders (`routes/`, `services/`,
  `hooks/`, `components/`) with smaller files. It gave no durable Slurp namespace and no clean
  cross-feature seam.
- **Migration consequence:** ten reviewable slices, recorded in `SLURP-MODULE-PLAN.md` and
  `SLURP-MODULE-STATUS.md`. Ownership shrinks to the three roots and two exceptions as files move.
  Persisted names, routes, and locale keys do not change.

## 2026-09-18 — Ship the refactor once, through an integration branch

- **Problem:** Each slice changes package source, so each needs a rebuild and version bump.
  Publishing every slice to `staging` would give users many intermediate versions of a half-finished
  restructure.
- **Decision:** Slice PRs target the `modular-simping` integration branch and use `0.0.x` versions
  there. One final PR merges it into `staging` as Slurp2 `0.1.0`.
- **Affected modules:** release process only; no source boundary changes.
- **Rejected alternative:** merging source-only slices to `staging` without rebuilding. The committed
  payload would drift from source, and the next unrelated Slurp2 fix would ship half-migrated code.
- **Migration consequence:** keep `modular-simping` merged with `staging`; the final PR folds the
  integration changelog entries into one `0.1.0` entry and removes unpublished `0.0.x` ZIPs.

## 2026-09-18 — Split the server by role: pure rules, persistence, features

- **Problem:** Slice 5 moved the 147 service files. 82 of them are pure domain rules, and 124 of the
  176 cross-feature imports pointed at those rules. Every feature service also called the storage
  composition, and the settings aggregate, storage context, and viewer context in `base/` imported
  domain rules. The layers `base <- features <- workflows` could not hold that graph without
  injection or permanent exceptions.
- **Decision:** Server layers become `base <- modules <- data <- features <- workflows <- entry`.
  `modules/` holds pure rules, `data/` holds persistence and the storage composition, and features
  keep routes, services, operations, and schedulers. The remaining real I/O calls between features
  go through small contracts.
- **Affected modules:** every server `slp` file; Slice 4 storage facets moved from `features/` to
  `data/`; settings and the record model moved to `modules/`; new server features `viewer`,
  `media`, and `settings` hold the route plumbing and the routes that left `base/`.
- **Rejected alternative:** injecting storage into about 57 call sites (not a pure move, more
  behaviour risk); a permanent exception for `slp-storage.ts` (the rules forbid it).
- **Migration consequence:** the architecture regression ranks `modules` and `data`, rejects I/O
  imports in server modules, and has negative fixtures for each new edge. Client layers are
  unchanged.

## 2026-09-19 — The modifier consumer builds the provider, not the entry

- **Problem:** Plan §4 said the server entry constructs the active-modifier provider. Slice 6 found
  that it cannot. The only new-subscription charge is computed inside one storage transaction in
  `data/economy/slp-economy-storage-1.ts`, and the platform-event list lives in Slurp settings,
  which Backstage edits at runtime. A provider built once during `activate()` would serve a frozen
  event list until the next Engine restart, and threading one through `createSlurpStorage` would
  also add a constructor dependency to three construction sites for no gain.
- **Decision:** The consuming feature builds the provider from the settings snapshot its own
  transaction already read, and passes it to a pure `slurpSubscriptionCharge(base, provider, at)`.
  Economy depends on `SlpActiveModifierProvider` and never on World, so the seam is unchanged.
  A saved event stores the modifier effect only; the producing source stamps `source` on at
  activation, which makes an id mismatch impossible.
- **Affected modules:** `base/modifiers/` (new), `modules/world/events/slp-platform-events.ts`,
  `modules/economy/slp-creator-pricing.ts`, `data/economy/slp-economy-storage-1.ts`, and the
  Backstage event editor, whose new-event literal gains the two defaulted fields.
- **Rejected alternative:** a provider constructed in the entry. It is either stale after a
  Backstage edit or forces a settings read per request inside the entry, which is the same work in
  a worse place. Also rejected: moving the charge out of the transaction, which plan §3 forbids.
- **Migration consequence:** calendar activation stays in `modules/world/events/` rather than moving
  to `features/world/events/` as §4 first said, because it is a pure rule under the Slice 5 layer
  model and the client reads it directly. Plan §3's allocation ledger already placed it there.

## 2026-09-19 — Shared pure rules move to `shared/src/slp/`, and the client gains a settings feature

- **Problem:** Slice 7 moved the client state layer into `packages/client/src/slp/`, where the
  architecture regression forbids importing server `slp` code. `SlurpSettings` needs
  `SlurpSimulationTuning`, `SlurpFanType`, `SlurpPlatformEvent`, and `SlurpModelBudget`, which lived
  in server `base/` and `modules/`. Thirteen client files already imported those rule files
  directly; pending decision 5 recorded the debt and assigned it to Slices 7–8.
- **Decision:** Move the closed set of pure rules both sides need into `shared/src/slp/`:
  `slp-tone.ts`, `slp-tuning.ts`, `slp-model-budget.ts`, `slp-modifier.types.ts`,
  `slp-modifier-schema.ts`, `slp-platform-events.ts`, `slp-fan-types.ts`, and `slp-population.ts`.
  Every importer's path is rewritten; no re-export shim is left behind. The client also gains
  `features/settings/`, mirroring the server feature added in Slice 5, so the settings document has
  one owner instead of being spread across maintenance and discovery.
- **Affected modules:** server `base/prompting/`, `base/model/`, `base/modifiers/`,
  `modules/audience/`, and `modules/world/events/` lose those eight files; `shared/src/slp/` gains
  them; client `slp/features/settings/` is new. The Slice 6 modifier seam is unchanged in behaviour:
  the resolver and provider stay in server `base/modifiers/` and now import the contract from shared.
- **Rejected alternative:** splitting each rule file into a shared type half and a server schema
  half. The types are `z.infer` of the schemas, so the split would separate a type from its only
  source of truth and duplicate the pairing. Also rejected: leaving the settings types outside the
  `slp` roots, which defers the same work to Slice 8 and keeps a client-to-server edge alive.
- **Migration consequence:** `shared/src/slp/` is no longer "pure functions only"; README now states
  the narrower test that replaced it. The plan's server allocation ledger moves these eight files to
  shared. Pending decision 5 is resolved for the hook layer; the remaining component importers in
  `components/slurp/` now import shared, so Slice 8 inherits no client-to-server edge.

## 2026-09-19 — Slice 10: the schema is a permanent exception, and the shell is a module

- **Problem:** the final ownership list in plan §5 had five entries and omitted
  `packages/server/src/db/schema/slurp.ts`, which is live and appears in **both**
  `slurpOwnedSourcePaths` (frozen legacy Slurp) and `slurp2OwnedSourcePaths`. Separately, the shell
  and the reusable Creator card could not go where plan §3 placed them: `NoodleShell` renders a
  wallet balance through `modules/coin/`, and the Creator card read a Discovery type, so putting
  either in `base/` would have broken the layer direction the same document defines.
- **Decision:** (1) the Drizzle schema stays at its path and becomes a third permanent ownership
  exception; moving it would rewrite table registration for the frozen legacy package. (2) The
  domain-neutral chrome (accent tokens, logo, avatar, scroll behaviour, media img) goes to
  `base/chrome/`, while the shell, its contract and the persona switcher go to `modules/chrome/`.
  (3) Types read by more than one layer move to `base/state/`: `SlurpDiscoverLayout`,
  `SlurpReserveStatus` and `SlurpScheduleSlot`, the last two re-exported from the feed contract so no
  feed consumer changes. (4) Five pure rule modules the client already imported across the
  client/server boundary move to `shared/src/slp/`: `slp-world.ts`, `slp-world-pulse.ts`,
  `slp-reach.ts`, `slp-audience-subscription.ts` and `slp-audience-characters.ts`.
- **Affected modules:** `base/chrome/`, `modules/chrome/` (new), `modules/settings/`,
  `modules/creator/`, `modules/audience/` (new), `base/state/`, `shared/src/slp/`, server
  `modules/audience/` and `modules/world/`, and the Discovery, Maintenance, Ads, Economy, Messages,
  Projects and Settings contracts, which gained the entries other features legitimately need.
- **Rejected alternative:** keeping the shell in `base/chrome/` and passing the wallet balance in as
  a prop. That changes a component API during a structural move, which plan §9 forbids. Also
  rejected: an allowlist for the client-to-server rule imports, since the plan requires the final
  regression to pass with no temporary exception.
- **Migration consequence:** plan §5's final ownership list becomes six entries, not five. The
  `focusRing` class string, copied byte-identically into four files by Slice 9, is now
  `base/chrome/slp-focus.ts`; the three `quietButton` composites stay separate because they differ in
  minimum height and animation, so merging them would change what renders.

## 2026-09-19 — Slice 11: ownership completion and the missing-export gate

- **Problem:** seven Slurp components still sat in `components/slurp/`, five of them above the size
  ceiling, and the architecture regression tolerated them by only flagging `slp`-named strays. The
  post cards read settings and the fan card, both feature code, from what the plan calls a module.
  The package typecheck caught TS2305 but not an unexported or doubly-bound import, which is what a
  mechanical split produces.
- **Decision:** (1) Each oversized component becomes a view-model hook plus render parts; a hook's
  type is `ReturnType` of the hook, so parts take the model instead of forty typed props. (2) The
  fan card and its member query move to `modules/audience/`; the post cards receive the Show-more
  threshold through the post-card controller instead of reading settings. (3) Cross-feature reads use
  contracts, including a new `slp-media-contract`. (4) The ownership rule covers any implementation
  file outside the roots; `slurp2OwnedSourcePaths` is the six entries, in both the builder and the
  catalog validator. (5) The typecheck gate reports TS2305, TS2459, TS2724 and TS2300.
- **Affected modules:** client `app/` and `app/screens/`, `features/messages/`, `features/onboarding/`,
  `features/creators/`, `features/projects/`, `modules/post/`, `modules/audience/`, the Creators,
  Discovery, Economy, Settings and Media contracts, server `data/slp-storage.ts`; the builder, the
  catalog validator, the typecheck script and their regressions.
- **Rejected alternative:** reusing the creator card's reply row and composer in the post card. The
  two differ in locale keys, fallbacks and the ask-for-reply control, so one component would change
  what one of them renders. Also rejected: rebaselining the client-hooks wiring counts after the
  member query moved.
- **Migration consequence:** no `components/slurp/` path remains, so no source test may read one
  except through `slurp2Source`. New Slurp2 code must live in the `slp` roots or one of the three
  permanent exceptions.

## 2026-09-19 — Slice 12: Slurp2 owns its social vocabulary

- **Problem:** Slurp2 imported 106 Noodle-named symbols from `@marinara-engine/shared`. Two of them
  named a type Slurp2 already declared itself, so the import resolved to nothing. The names describe
  Slurp2's own `slurp2_*` rows and its own `/api/slurp2` payloads, yet the package could not build
  without the Engine's Noodle vocabulary, and its own copy still said NoodleR.
- **Gate:** Slurp2 never receives Engine-produced Noodle data, so none of those names is an Engine
  contract. Evidence: `grep -rn "noodle_" packages/slurp2/src` returns nothing, and Slurp2's Drizzle
  symbols all resolve to its own `slurp2_*` schema; the host activation surface in
  `slp-server-entry.ts` passes no Noodle-shaped value in or out; Engine
  `services/import/profile-import-noodle.ts` has exactly one importer, Engine `backup.routes.ts`,
  which Slurp2 never reaches; Engine backup keys off `noodle_*` names and the `noodle:backup`
  capability while Slurp2 registers its own `slurp2:backup` no-op pause; and the persona and
  character source bridge in `slp-source-resolve.ts` crosses on Engine `Character` and `Persona`, a
  `SlpAccount` appearing only as `Pick<…, "kind" | "entityId">`, a Slurp2 row holding a pointer.
- **Decision:** (1) The Engine is not changed. Frozen legacy Slurp is never rebuilt, so renaming
  Engine types would leave it unbuildable and a future security fix to it could not ship. (2) All
  202 declarations of the Engine's Noodle types, schemas and utilities are copied into
  `shared/src/slp/` as `slp-social.types.ts`, `slp-social.schema.ts`,
  `slp-social-generation.schema.ts`, `slp-mentions.ts`, `slp-polls.ts`, `slp-post-images.ts`,
  `slp-creator-onboarding.ts` and `slp-interactions.ts`, renamed `Noodle` → `Slp` and
  `Noodler` → `SlpCreator`. (3) `AvatarCrop` and `avatarCropSchema` stay Engine imports: Engine
  avatar rendering consumes them. (4) No re-export shim and no alias back to the old name.
- **Classification:** every reclassified name and its replacement is recorded in
  `slurp2-vocabulary-rename-map.json` (202 entries) and `slurp2-owned-vocabulary.json` (the 190
  exported ones). The only names Slurp2 may still take from the Engine are `APIProvider`,
  `AvatarCrop`, `avatarCropSchema`, `normalizeAvatarCrop`, `Persona`, `PROFESSOR_MARI_ID`,
  `CSRF_HEADER`, `CSRF_HEADER_VALUE`, `LIMITS` and `isOpenAIGpt56Model`. No name was ambiguous.
- **Affected modules:** the whole `shared/src/slp` root, 127 client and server `slp` files, and two
  new regressions, `slurp2-owned-vocabulary` and `slurp2-vocabulary-shape`.
- **Rejected alternative:** renaming the types in Marinara-Engine. It would break the next build of
  frozen legacy Slurp, which is never rebuilt and so could never ship a security fix again. Also
  rejected: a re-export shim, which would leave the old vocabulary reachable and never removed.
- **Migration consequence:** none. Every `slurp2_*` table and column, stored JSON key, storage key,
  settings key, locale key, route path and the `platform` value `"noodler"` is unchanged, so the
  change is compile-time only. `slurp2-vocabulary-shape` proves all 202 copied declarations are
  shape-identical to the Engine originals; it needs `MARINARA_ENGINE_ROOT` and reports a skip
  without one.
- **Decision:** Slurp2 operation routes use `/api/slurp2/slurp/*`, with the same methods, parameters,
  bodies, responses and handlers. Four GET media routes remain at `/api/slurp2/noodler/*` because
  account rows, Garnish records and post rows can persist those URLs, and backups preserve them:
  avatar, banner, ad image and post image. New media writes use the Slurp paths and new post media
  URLs remain the existing post-media URL so future stored rows also use the retained route.
- **Proof:** `slurp2-route-inventory.regression.ts` maps the new inventory back to the staging
  baseline, checks 179 routes, the HTTP-method multiset, per-feature handler counts, explicit
  retained paths, and negative fixtures for a missing route and a changed method. The client-hooks
  regression checks the request mapping and preserves all eleven wiring counts.
- **Migration consequence:** none. No table, column, JSON key, locale key, platform value, backup
  format, stored media path or response shape changed. The manifest requires an Engine restart on
  update, so an old client bundle cannot run against the new operation routes after an update.

## Planner and continuity ledger (2026-09-21)

- **Decision:** the planner decides before the model is called, and stores the decision first.
  `slurp2_content_opportunities` records intent, delivery, workflow, access, the promise it answers,
  and the post it produced. A chosen skip is a stored decision, not an absence. The model writes the
  Creator's voice and nothing else: it never decides access, charges, campaign stages, or skips.
- **Decision:** intent, delivery, and workflow are three axes, not one list. The shipped list mixed
  them, so a Story could never also be a thank-you and text-only was only ever a failure.
- **Decision:** continuity lives in one Slurp-owned ledger (`slurp2_continuity_facts`,
  `slurp2_continuity_events`, `slurp2_continuity_proposals`) keyed on the source Character or
  Persona as well as the Slurp account. There is no canon-map table: the accounts table already
  enforces one Creator per `(sourceKind, sourceEntityId)`.
- **Decision:** one read rule, `slurpContinuityReadable`, decides privacy for every surface. A
  thread-private record never reaches a post or another thread; `canon_only` reaches only the editor;
  conversation, roleplay, and game records are stored but never read by a Slurp prompt, so a scene is
  not history. Prompts read only confirmed or active, unexpired records.
- **Decision:** extraction proposes and the rules dispose. The model may cite only message ids from a
  server-built allowlist and must quote evidence present in that message. The Creator's own explicit
  limits, plans, and business rules apply automatically; personal disclosures wait as proposals.
- **Decision:** promotion writes a new derived record rather than mutating the private source, so the
  source keeps its audience and can still be retracted.
- **Affected modules:** `modules/feed/` (planner, axes, campaign, media reuse, demand),
  `modules/continuity/`, `modules/creators/slp-creator-strategy.ts`, `data/feed/`,
  `data/continuity/`, `features/feed/slp-post-plan-service.ts`, `features/messages/`, and the
  Creator Continuity tab.
- **Rejected alternative:** keeping the Classic runtime mode. Every planner decision would have
  needed a second, older code path. The old prompt wording survives as a selectable preset instead.
- **Migration consequence:** additive. New tables, a new optional `strategy` key in account settings,
  and `classicPromptBlocks` in Slurp settings. Old prompt-block layouts migrate in place, keeping
  their edits and gaining new blocks at their inventory position.

## Host-owned generation integrations (2026-09-21)

- **Problem:** The Creator posting path called Engine provider and image implementations directly.
  That copied host integration details into the package and could bypass newer host queues, admission,
  fallback, and media lifecycle behavior.
- **Decision:** The Creator posting path keeps prompt construction and generation orchestration, but
  uses the Engine's Capability API 1.31 integration facade for its LLM provider, image generation, and
  staged image writes. A small `base/host` adapter stores the activation-scoped facade. Other Slurp2
  generation features retain their existing host-service path until a separate migration slice covers
  them.
- **Affected modules:** `base/host/slp-generation-integrations.ts`, Creator post generation, Creator
  image generation, server activation, the package manifest, and the build boundary metadata.
- **Rejected alternative:** copying the Engine's provider and image implementations into Slurp2. That
  would duplicate security and queue behavior and would drift on every Engine generation change.
- **Migration consequence:** Slurp2 now requires Engine 2.4.6 and Capability API 1.31. Existing Slurp
  data is unchanged. Package activation fails on older Engines instead of silently using an incomplete
  Creator posting integration.

## Prompt intent is the source of truth (2026-09-21)

- **Problem:** Slurp has several valid prompt controls: global prompt blocks, global generation and
  image settings, Creator stage and content settings, production strategy, current Creator state,
  and message relationship state. They were all expressed as prose. Image interpretation could
  therefore treat a personality or adult image instruction as permission to change the post's scene.
- **Decision:** The post's subject, action, setting, clothing, and sexual intensity are the visual
  intent. The post prompt blocks and Creator settings may shape that intent, but image interpretation
  may only render it. Stable appearance and style add detail after intent. They may not add an event,
  person, outfit, viewpoint, nudity, explicit anatomy, or sexual activity. The post caption remains a
  related text output, not the image source. Message image requests use the same Creator content menu
  and relationship boundaries, with thread state deciding whether adult escalation is permitted.
- **Affected modules:** `base/prompting/slp-prompt-blocks.ts`, `base/media/slp-image-prompt-rewrite.ts`,
  `features/feed/`, `features/media/`, `features/messages/`, and the global image settings defaults.
- **Rejected alternative:** adding a second Creator-specific image prompt system. The existing block
  editor, global image settings, Creator image preferences, content menu, and message relationship
  state already provide the required controls. A second system would create conflicting sources of
  truth.
- **Migration consequence:** the shipped image defaults become non-escalating. Exact older shipped
  defaults migrate to the new values; user-edited text remains unchanged. Stored posts and image
  prompts are not rewritten.

## Typed visual brief between planning and rendering (2026-09-21)

- **Problem:** Post planning already knew the place, action, company, camera, effort, and delivery,
  but the image path reduced those facts to free text before interpretation. A style or adult image
  instruction could therefore change the scene after planning.
- **Decision:** Automatic post planning creates a `SlurpVisualBrief` in `base/media/`. It carries the
  authoritative subject, action, setting, company, clothing, camera, mood, and sexual level. Image
  interpretation receives both the typed brief and the old text draft. The typed brief constrains the
  rewrite, and the policy text is appended to the final provider prompt. Deep Details records the
  brief when one exists. Existing stored image prompt strings remain compatible.
- **Affected modules:** `base/media/slp-visual-brief.ts`, `modules/feed/slp-visual-brief.ts`, post
  generation, both Creator image services, Deep Details, and the prompt preview inspector.
- **Rejected alternative:** replacing the stored image prompt with a new JSON payload. Existing posts,
  image review, retries, and media records already use prompt strings. The typed brief is additive and
  remains an internal generation contract.
- **Migration consequence:** no stored post changes. New automatic posts record typed visual intent;
  older posts continue to use their stored image prompts. Prompt previews now label block inspection
  separately from full post generation.
