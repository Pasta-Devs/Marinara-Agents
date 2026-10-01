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
  therefore treat a personality or image instruction as permission to change the post's scene.
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

## Subject-aware story influences and occurrence ledger (2026-09-22)

- **Problem:** annual platform events could modify one global price calculation, while arcs carried
  separate chapter effects. Neither contract could explain a result for one Creator, and triggered
  events had no durable identity across ticks or restarts.
- **Decision:** portable arc and event blueprints use a closed influence-target vocabulary. Consumers
  ask a subject-aware resolver for one target, time, and Creator; the resolver orders sources,
  multiplies before adding, and leaves final clamping and rounding to the consumer. Narrative
  guidance, facts, and arc opportunities stay typed non-numeric contracts rather than entering the
  numeric resolver.
- **Decision:** every event activation first writes an immutable occurrence snapshot containing its
  activation key, trigger evidence, participants, interval, status, and complete blueprint. Effects
  and outcomes read that snapshot, never the mutable library row. Stable activation keys make clock
  catch-up and repeated ticks idempotent.
- **Affected modules:** shared story schemas, World event reconciliation and storage, arc blueprints,
  story-pack import/export, and numeric simulation consumers.
- **Rejected alternative:** a general event bus with arbitrary field paths. It would make ordering,
  bounds, replay, import validation, and user-facing explanations depend on executable behavior.
- **Migration consequence:** legacy calendar rows normalize into annual blueprints. Existing running
  arcs remain copied snapshots. Occurrences, facts, opportunities, and checkpoints use package-owned
  settings records and therefore travel with the existing backup/restore namespace.

## Messaging Details edits (2026-09-27)

- The client and server share `slp-message-details.ts` for the closed set of editable fields, enum choices and numeric bounds.
- Creator and conversation state edits write their existing records. Calculated rapport and context edits live in per-thread `slurp2.messages.details.*` settings and are consumed by thread views, rapport scoring and message preparation. Editing displayed spending never creates a payment or alters the ledger.
- The Details toggle only enables controls; switching it off does not undo saved edits.

## Life moments and other Agents' data in the flavour brief (2026-09-27)

- **Life moments** (`modules/feed/slp-life-moments.ts`) are a beat source between the player's steering and the
  card deck: day-to-day moments from the Creator's own anchors plus a shared pool, used only when the card fits
  (a word test on card, tags and anchors; a card "never" sentence rules a moment out). Milestones, viral posts,
  gifts and comment fights need a real signal (`data/feed/slp-life-signals.ts`). Beat `anchorKind: "life"`,
  keyed `sharedId: "life:…"`, so the existing per-day cap and beat history carry the variety rules. No new AI call.
- **Storyline fit:** automatic storylines pass the Creator's card text to `slurpAutoArcPick`; a built-in type
  whose needs are missing (a breakup without a partner) is never started on its own. Built-in types added in a
  later version join a saved library; deleting a built-in keeps hiding it.
- **Other Agents' data** (`data/creators/slp-agent-memory-source.ts`), behind the `flavourFromAgents` setting (on by
  default): read-only reads of the Engine `game_state_snapshots` table (Character Tracker, World State, Persona
  Stats; the package holds `chat-read`) through the Engine schema already in `sources/engine`, and Long-Term
  Memory's in-process `long-term-memory:storage` service through the Engine service registry. None of these
  Agents offers a documented read contract; any failure yields no lines. Rejected: a new Engine snapshot file
  (`game-state.storage.ts`), which would change the captured Engine sources.

## Action layer and Professor Mari (2026-09-28)

- **Problem:** AI help was scattered: a composer "Guide" that wrote and published a whole post, an
  "AI image" switch that drew after posting, "Draft voice" on fan types, "Write with AI" on post
  guidance, a separate artwork tool on the profile and in Creator settings. Each had its own look,
  its own budget handling (or none) and no Undo. Nothing outside the app could ask Slurp to do
  anything for the player.
- **Decision:** one named action layer (`shared/src/slp/slp-actions.ts`, runner in
  `features/assist/slp-action-runner.ts`) with a strict schema per action, served over
  `/slurp/actions` and as the in-process service `slurp2:actions`. The client's AI assist is two
  shared components (`SlpTextAssist`, `SlpPictureAssist`) that call it. The old buttons fold into
  them: Guide → Write / Improve on the caption (the text lands in the field; the player posts),
  AI image → Draw a picture (seen before posting), Draft voice and Write with AI → the text assist
  with their own writers (`run`), both artwork tools → the picture assist (Creator settings keep the
  context switches under Advanced). The whole-profile draft (Generate / Rewrite draft from the
  source card), Build with AI for storylines, wardrobe import, "Let them answer" in Creator DMs and
  the prompt-as-written redraw box stay: each does something no single field assist does.
- **Affected modules:** new `features/assist/` (client + server), `modules/assist/`, shared
  `slp-actions.ts`; the model budget gains the `assist` job ("Writing help", present work).
  `resolveSlurpAutomaticPostAccess` joins the feed contract (the runner's `write-post` needs it).
  `SlpPostCardCtx` gains a `textAssist` render slot so the post edit sheet (a module) can show it.
- **Rejected alternatives:** running the actions by injecting into the existing routes (it would
  need the Engine's internal route token for every call and duplicate each route's error
  mapping); one assist component per field (the duplicates this step removes); keeping drawn
  pictures as draft files on disk (a data URL answer needs no storage, no serving route and no
  cleanup; "Use" goes through the existing upload paths).
- **Professor Mari (Engine @079c0ab00, read-only):** there is no Engine API through which a
  capability package can give Mari an action. What exists and what is missing:
  - Mari's tools are a fixed list: `WORKSPACE_TOOLS` and `WORKSPACE_TOOL_DEFINITIONS` in
    `packages/server/src/services/professor-mari/workspace-agent.service.ts` (l.168, l.302), the
    `MariWorkspaceToolName` union in `packages/shared/src/types/professor-mari-workspace.ts`, and the
    dispatch `switch` (≈l.3530) that answers "Unknown workspace command" for anything else.
  - Her `mari` CLI (`packages/server/src/bin/mari.ts`) only reaches
    `/api/professor-mari/workspace/db/command` (the Mari DB service: tables, rows, characters,
    lorebooks, presets), never a package route. Raw `bash` runs with network denied
    (`workspace-shell-sandbox.ts`, `(deny network*)`). Skills are the user's own SKILL.md files in
    the workspace; no API lets a package add one.
  - The capability activation API (`capability-module-runtime.service.ts`, `CapabilityActivationContext`)
    offers `registerService`, `registerConversationCommand` (Conversation chats, not Mari),
    `registerPromptContext` (chat system prompt), `registerPrivilegedRoutes`, `runInternalRoute`.
    No tool or action registration, and no manifest field for one.
  - `getCapabilityService(key)` (`capability-service-registry.service.ts`) already lets Engine code
    look a package service up. So the smallest Engine change is: one new Mari workspace tool (e.g.
    `package_action`) that lists `getCapabilityService("<pkg>:actions")?.list()` in its tool
    description and calls `.run(name, input)`; its name added to the union, the two lists and the
    switch; plus the same approval gate Mari uses for writes (`apply: true` and a reason) and, if
    wanted, a manifest permission such as `mari-actions` so the user sees which packages Mari can act
    through. Slurp already registers `slurp2:actions` with exactly `{ list, run }`; nothing on the
    package side would change.
- **Migration consequence:** none stored. A saved AI budget without the `assist` row reads it with
  its default (40 a day). The drawn picture Undo lives in memory: a restart between Use and Undo
  loses that Undo and leaves one old file behind (`ponytail:` note in `slp-picture-undo.ts`).

## Professor Mari actions (J2, 2026-09-28)

- **Problem:** Engine PR #6800 (draft, issue #6799) lets Professor Mari list and run package actions
  through `package_service`, for packages that register `mari-actions:<package-id>` with
  `{ list, run }` and hold the new `mari-actions` permission. The Engine's manifest schema accepts
  that permission only with `capabilityApi` 1.50 or newer, and an Engine without #6800 rejects a
  manifest that names an unknown permission, so shipping the permission today would make Slurp
  uninstallable on every released Engine.
- **Decision:** the permission lives in the slurp2 builder definition as an optional permission
  (`optionalPermissions: [{ permission: "mari-actions", capabilityApi: 1.50 }]`). The builder emits it
  only when the feature's own `capabilityApi` reaches 1.50, so the day slurp2 declares 1.50 (a
  deliberate minimum bump, once an Engine with #6800 ships) the manifest gains it with no other
  change. The server feature-detects from its own manifest: `slpActionServiceKeys` registers
  `mari-actions:slurp2` (the same `{ list, run }` object as `slurp2:actions`) only when the
  permission is there, and a failed registration is a warning, never a failed activation. The action
  layer gains `list-creators` (read-only) so Mari can find the `accountId` every other action takes.
- **Affected modules:** `scripts/build-feature-packages.mjs` (`featurePermissions`), `slp-server-entry.ts`,
  `features/assist/slp-action-runner.ts`, shared `slp-actions.ts`.
- **Rejected alternatives:** emitting the permission now with `capabilityApi` 1.50 (no released Engine
  would install Slurp); reading the build Engine's supported API to decide (the devbox Engine checkout
  is older than the manifest's own 1.31, so the answer would not follow what the package declares).
- **Migration consequence:** none. Manifest, catalog lanes and minimum Engine stay as they were
  (`capabilityApi` 1.31); `run` ignores Mari's abort signal (an action is one bounded model call or
  one write, and the Engine stops waiting on its own deadline).

## Stir: one lever system over the action layer (W, 2026-09-28)

- **Problem:** the things that make something happen in the world lived in five places (Studio's
  Business and Relationships, the steering card in Creator tools, Backstage "Start now", the chapter
  controls, Pulse "Run audience"), each calling its own route, and a player who runs no page could not
  reach Studio's world controls at all.
- **Decision:** every lever is an action in the one layer (`shared/src/slp/slp-actions.ts`): the tie
  levers (suggest / push a collab, start / cool a rivalry, set up / steer a couple, open / close a
  couple page), start an event, move a storyline chapter, wake the fans, a Creator's spice level, and
  the read-only `list-world`. Each action carries Stir metadata (`SLP_ACTION_META`: deck category,
  target, reversible, AI now, may be refused, deck card) and has a `preview` that writes nothing
  (`features/assist/slp-action-preview.ts`; the tie previews are pure,
  `modules/projects/slp-stir-tie-preview.ts`). The Stir tab, the ✦ sheet, the plain-words planner,
  Slurp Support and Professor Mari all go through `preview` → "Do it" → the same runner. A play is kept
  in a short ledger (`data/assist/slp-stir-plays-storage.ts`) with what one Undo needs. The planner is
  one model call on a new AI budget row "Plans" (`plan`, 20 a day, present work). Slurp Support's
  "staff" answer now proposes Stir cards on the reply instead of changing the steering at once (the
  memory of the talk is still kept at once).
- **Affected modules:** shared `slp-actions.ts`, `slp-stir.ts`, `slp-model-budget.ts`; server
  `features/assist/` (runner, preview, levers, Stir service and routes, a new contract for the
  planner), `features/projects/slp-stir-ties.ts` (through the projects contract),
  `modules/assist/slp-stir-{plan,play,live}.ts`, `modules/projects/slp-stir-tie-preview.ts`,
  `modules/messages/slp-support.ts`, the message operation, the DM prompt and response format; client
  `features/stir/`.
- **Rejected alternatives:** a Stir screen calling the Studio routes directly (the planner, Support and
  Mari would each need their own copy); keeping Support's direct steering writes next to the cards (two
  writers again, the concept's overlap 7); a "Control room" that merges Pulse and levers (an admin
  panel, not a game).
- **Migration consequence:** none stored. Old Support notes keep their Undo; a saved AI budget without
  the `plan` row reads its default. Old Studio deep links open the Stir tab. The Studio routes stay for
  the Business and Relationships lists, which moved into Stir unchanged.

## Brands and products (R, 2026-09-28)

- **Problem:** ads were flat rows (a brand name and one product each), brand deals picked one of
  them by word overlap, and the player could only edit single ads. The player wants brands that hold
  products, Creators sponsored through them, brands and products of their own in Backstage, and a
  set of shipped parody brands, without losing the ads that exist.
- **Decision:** Garnish gains a `GarnishBrand` (name, category, tone, logo prompt, logo, on/off) in
  its own app-settings blob (`garnish.brands`). A product stays an ad: `GarnishAd` gains `brandId`,
  `priceFeel` and `look`, and its `contentRating` is the product's spice fit. An ad without
  `brandId` belongs to the brand named like it (`garnishAdBrandId` = `brand-<slug of name>`), and
  shipped brands use the same id, so old ads, edited shipped ads and imports land under a brand with
  no data rewritten. A switched-off brand hides all its products (`listActive`); a shipped brand is
  switched off, never deleted. Brand deals read the brand's category and voice and the product's look
  and spice fit (a suggestive product only to a suggestive or explicit Creator, explicit only to
  explicit), and a new setting `brandDealsPace` (off / rare / normal / often; normal = before)
  scales how often a brand looks. The Stir lever is the action `offer-brand-deal` with a `preview`
  switch (pure rules in `slurpDealLever`; the preview and the run give the same offer), plus
  `list-brands` and `draw-brand-picture` (the 3c picture assist draws logos and product pictures).
- **Affected modules:** `services/garnish-ads/*` (types, base, storage, export), `features/ads`
  (new `slp-brands-routes.ts`, image service, ads routes), `modules/economy/slp-brand-deals.ts`,
  `modules/feed/slp-tie-beats.ts`, `features/projects` (new `slp-brand-deal-source.ts`,
  `slp-brand-deal-lever.ts`), shared `slp-actions.ts`, the action runner; client `features/ads`
  (new `SlpBrandsPanel.tsx`, `slp-brands-hooks.ts`), `SlpPictureAssist` (`drawWith`).
- **Rejected alternatives:** a separate product table next to the ads (two lists for one thing, and
  every reader of the pool would need both); rewriting stored ads with a `brandId` on first read
  (a write on a read path, and an export from an older build would undo it).
- **Migration consequence:** none stored. Old ads keep their ids and show under a brand named like
  them; old deals read back without `look` / `tone`; a settings blob without `brandDealsPace` reads
  "normal"; an export without `brands` still imports. Garnish stays extractable: nothing in
  `garnish-ads/` imports Slurp (the boundary test still passes).

## Merge V, M, R, F: brand deals in Stir, Posts per day sized (2026-09-29)

- **Problem:** R left `offer-brand-deal` as a "soon" hook for Stir; the user decided on F that
  "Posts per day" grows with the Creators like the AI budget, but it has ~20 readers.
- **Decision:** `offer-brand-deal` is a work card in the deck and a planner action (the planner gets
  the switched-on brands); `list-brands` takes an optional `accountId` and marks each product
  `fits` / `spice` / `offBrand` (R's two fit rules); the Stir picker lists fitting products and "Show
  all" reveals the rest with why. "Posts per day" is sized once, at the settings read
  (`getSettings`: `2 + 1.9 × active Creators` unless `postsPerDayCustom`), so every reader sees the
  same number; a PATCH that sends a number marks it the player's; the defaults route carries the
  same sizing so a section reset lets it grow again.
- **Affected modules:** shared `slp-actions.ts`, `slp-stir.ts`, `slp-model-budget.ts`; server
  `features/projects/slp-brand-deal-lever.ts`, `features/assist/`, `modules/assist/slp-stir-*`,
  `features/ads/slp-garnish-generation-service.ts`, `data/creators/slp-creators-storage-{1,2}.ts`,
  `modules/settings/slp-settings.ts`, settings routes; client `features/stir/`, Publishing panel.
- **Rejected alternatives:** sizing at each of the ~20 readers (one would be missed); storing the
  sized number on every Creator change (a write per Creator toggle, and stale on import).
- **Migration consequence:** a save without `postsPerDayCustom` keeps any number other than the
  shipped 4 as the player's; the shipped 4 grows.

## Pulse + E: long actions are Pulse tasks; follow-ups are promises (2026-09-29)

- **Problem:** long actions held the player (the Stir play sheet and the sign-up modal could not
  close, the composer waited for the post's AI picture, a Stir plan was lost when the player left
  the box), and Pulse showed each pending mutation twice, without a name, reason or retry. A
  follow-up blocked for two days was dropped, and automatic Creators never answered an AI fan.
- **Decision:** one client task tracker, `base/state/slp-task-store.ts` (`startSlpTask`): the caller
  closes its sheet at once, the task runs on, Pulse lists it (running / done with a result and a
  tap-through / failed with why and Try again), a toast says how it went with See in Pulse. Its
  words come from the caller's `t` (the package's bundled `i18next` is never initialised). Pulse's
  open state lives in that store, so any screen or toast opens it. The server's `/slurp/tasks`
  also sends Stir plays, a `retry` route per failed task and a `next` list ("Coming up", pure in
  `modules/maintenance/slp-pulse.ts`). Follow-ups keep `first_due_at`; a wait never ends a promise
  (only an opener expires), a failed one retries later by how late it is, a late one opens with an
  in-character sorry. The unattended reply path answers an AI fan's text when
  `slurpAnswersAiFan` picks it (1 in 4, by message id), text only, inside the AI budget.
- **Affected modules:** client `base/state/slp-task-store.ts`, `slp-task-list.ts`,
  `slp-stir-sheet-store.ts`, `modules/chrome/SlpPulse*.tsx`, `slp-pulse-model.ts`, `SlpShell.tsx`,
  `features/stir/`, `features/onboarding/`, `app/slp-home-*.ts`; server
  `features/maintenance/slp-maintenance-routes.ts`, `modules/maintenance/slp-pulse.ts`,
  `features/messages/slp-message-operation.ts`, `slp-follow-up-scheduler-service.ts`,
  `data/messages/slp-messages-storage-follow-ups.ts`, `modules/messages/slp-{follow-up,messaging}.ts`,
  schema `slurp2_follow_ups.first_due_at`.
- **Rejected alternatives:** server job rows for every long action (a migration and a poller for
  work that already returns in one request); reading `useMutationState` for Pulse (no name, no
  result, no retry, and every mutation twice); a stored attempt count for follow-up retries (the
  lateness already says how often it failed).
- **Migration consequence:** follow-up rows from before have no `first_due_at`; their current
  `scheduledAt` stands in. Client tasks live in memory for the tab (a reload forgets finished ones;
  server jobs and plays stay in Pulse).

## World dial rule moves to shared (L, R1-116, 2026-09-28)

- **Problem:** the audience estimate in Backstage (client) ignored the world-activity dial because
  its rule (`slurpWorldActivityMultiplier`) lived in server `modules/audience/slp-scale.ts`, which the
  client may not import. A copy of the multiplier on the client would be a second rule to keep in step.
- **Decision:** `slp-scale.ts` is pure and has no imports, so it moves as is to
  `shared/src/slp/slp-scale.ts`; every server reader imports it from there. The estimate now reads it,
  plus the Fan Types, the background-profile switch and the AI-written fan runs.
- **Affected modules:** shared `slp-scale.ts`; the eight server importers; client
  `modules/audience/slp-simulation-estimate.ts`; `tests/slurp2-source.ts` maps the historical key.
- **Rejected alternatives:** passing the multiplier in from the settings screen (the screen would own
  the rule instead).
- **Migration consequence:** none stored.

## Merge L + Pulse follow-ups: per-fan answers, promises past the switch, Pulse history kept (2026-09-29)

- **Problem:** after Pulse + E, an AI fan was answered per message (a fan who got an answer could be
  ignored on the next one), the "writes first" switch cancelled promises the Creator made in a reply,
  and Pulse forgot finished client tasks on every reload.
- **Decision:** `slurpAnswersAiFan(message, answeredBefore)`: a fan the Creator already wrote to in
  this thread keeps the conversation while the thread lives (text only, still the unattended reply
  path and its budget row). The follow-up scheduler drops only `opener` rows when the switch is off;
  every other follow-up is a promise and goes out (the world tick already makes no new openers). The
  client task store keeps finished tasks in `localStorage` (`slurp2:pulse-tasks`, the pure
  `slpStoredTasks`: done / failed, last 24 h, 50 rows, without the tab's Open / Try again functions).
- **Affected modules:** server `modules/messages/slp-messaging.ts`,
  `features/messages/slp-message-operation.ts`, `slp-follow-up-scheduler-service.ts`; client
  `base/state/slp-task-{list,store}.ts`; the switch's help text.
- **Rejected alternatives:** a stored "answered" flag on the thread (the thread's own messages
  already say it); zustand `persist` (the package's other stored state uses plain `localStorage`).
- **Migration consequence:** none stored server-side; a browser without the key starts with an empty
  Pulse history.

## 0.3.2 Creator Pages: one shared page schema, filled by code (2026-09-29)

- **Problem:** a Creator could present themselves only through a bio and posts. A Page needs one
  shape that the server stores and repairs (including a model's answer) and the client renders and
  edits, without letting the model write facts that go stale.
- **Decision:** `shared/src/slp/slp-creator-page.ts` holds the schema, limits and a lenient reader
  that drops a bad block and keeps the rest. The Page stores only a theme id, block order and words;
  pictures, prices, facts, people and the poll are filled on the client from data the profile already
  loads. The Page lives in `settings.profile.page` (plus `pageWanted` for a new Creator's first Page)
  and is on the audience allowlist. Model work sits in `features/creators/slp-creator-page-service.ts`
  behind a new AI budget row (`page`); catch-up on open runs it detached, at most once at a time.
- **Affected modules:** shared `slp-creator-page.ts`, `slp-social.schema.ts`/`types.ts`,
  `slp-model-budget.ts`; server `modules/creators/slp-creator-page-{prompt,refresh}.ts`,
  `modules/creators/slp-disclosure.ts`, `modules/records/slp-storage-model.ts`, the creators and
  onboarding routes, `workflows/slp-world-tick-workflow.ts`; client `modules/creator/SlpCreatorPage.tsx`,
  `slp-creator-page-{data,styles}.ts`, `features/creators/SlpCreatorPageEditor.tsx`,
  `app/screens/SlpProfilePage.tsx` and the `pageContent` slot of `SlpProfileSurface`.
- **Rejected alternatives:** storing the rendered page (prices and pictures would go stale); a
  generated collage picture (costs an image call, drifts from the look, cannot be tapped); a sixth
  profile tab (five already crowd a phone).
- **Migration consequence:** none; both fields are optional and absent on existing accounts.

## 0.3.5 Slurp Support desk: a desk record per Creator, a `messages/desk` seam (2026-09-29)

- **Problem:** Slurp Support's thread ran on the fan-chat machinery (rapport, strikes, pictures, fees),
  which does not describe a Creator's standing with the platform, and Support had two tools. The
  design (`docs/SUPPORT-DESK.md`) adds trust, suspicion, offers, tickets, challenges, contracts,
  leaving, notices and eight desk actions.
- **Decision:** one desk record per Creator in app settings (`slurp2.creator.<id>.desk`, like the
  steering), read through `shared/src/slp/slp-support-desk.ts` (pure rules and the settings schema,
  both sides need them). The desk's routes, send-time checks, reply handling and clock live in the
  new seam `features/messages/desk/`; its actions join the one action layer
  (`features/assist/slp-desk-levers.ts`), so an Offer the Creator accepts runs through the same
  runner. The world clock runs the desk on templates only; a Creator's line is rewritten on open
  (pending-text kind `desk`, prompt `pendingDesk`). The reach effects go through the one
  `platformInfluenceMultiplier("feed.reach")`.
- **Affected modules:** shared `slp-support-desk.ts`, `slp-actions.ts`, `slp-stir.ts`; server
  `data/creators/slp-support-desk-{storage,counts}.ts`, `data/messages/slp-support-desk-thread.ts`,
  `modules/messages/slp-support-desk-talk.ts`, `features/messages/desk/*`, the thread, send and
  generation paths, `features/world/slp-pending-text-service.ts`, the world scheduler and tick
  workflow; client `modules/desk/SlpDeskCaseFile.tsx`, `features/messages/SlpDesk*.tsx`,
  `features/stir/SlpStirDesk.tsx`, `SlpStirDeskFields.tsx`, `SlpStirSettingsPanel.tsx` and a new
  Backstage section `stir`.
- **Rejected alternatives:** new message kinds (`offer`, `note`) in the stored enum (a `system` or
  `text` line with metadata needs no schema change and older clients render it); a table for the
  desk (an app-settings record per Creator follows the steering and needs no migration); keeping
  Support threads in every persona's inbox (they are staff work, not the persona's chats).
- **Migration consequence:** none stored; a Creator without a record starts neutral on the first
  desk pass, and one Support signed up starts warmer when its sign-up chat is kept.

## 0.3.5 Polyamory: `moreIds` on a couple, group helpers apart (2026-09-29)

- **Problem:** a couple could only be two people.
- **Decision:** `SlurpCouple.moreIds` (up to two more, four people in all); the pair (`aId`, `bId`)
  still drives the stage clock. Group rules, names and the couple-page money helpers
  (`slurpCoupleBuzz`, `slurpCouplePageSplit`, now N-way) live in `modules/projects/slp-couple-group.ts`,
  keeping `slp-creator-couples.ts` under the file limit. Off by default (`polyamory` setting).
- **Also:** a polyamorous Creator may be in several couples (`slurpSetUpCouple` with `polyamory`); a
  Creator's style is `relationshipStyle` in their steering (null = poly words on their card,
  `SLP_POLY_CARD_WORDS`), read into `SlurpTieCreator.poly`. Monogamous Creators keep the old rule.
- **Rejected alternatives:** only overlapping pairs (a throuple would read as three separate couples);
  only groups (a Creator with two separate partners could not exist).
- **Migration consequence:** none; `moreIds` and `relationshipStyle` are optional.

## 0.3.8 Drama: situations and dramas as Story Pack data, no new domain (2026-09-30)

- **Problem:** couples, collabs and rivalries are hard-coded dramas the player cannot join, the
  world has no friends, roommates or exes, and a new kind of drama needs new code. Design:
  `docs/DRAMA.md`.
- **Decision:** no new top-level domain. Dramas and standing situations are new optional
  arrays in the Story Pack schema (`shared/src/slp/slp-story-engine.ts`); a running drama is an arc
  with a cast; new tie types (`friend`, `roommate`, `coworker`, `ex`) join the ties document; the
  player's persona Creator can be one side of a tie; arc choices may ask the player or a Creator;
  a hidden fact is a continuity record with `knownBy`, read through the one continuity gate. Posts
  get at most one drama line through the existing beat brief; comments come from the reaction bank.
- **Affected modules (planned):** shared `slp-story-engine.ts`; server `modules/projects/*` (ties,
  couples, arc progress), `modules/feed/slp-tie-beats.ts`, `modules/continuity/*`,
  `modules/world/slp-reaction-bank.ts`, `features/assist/slp-stir-*`, the world tick; client Backstage,
  Creator settings, Stir, Creator Page People block.
- **Rejected alternatives:** a separate "social world" graph store beside ties and continuity (two
  sources of truth for relations and facts); hard-coded dramas per genre (every new drama would be
  code); a relation/fact dump in the post prompt (infodumps cost heat and tokens).
- **Migration consequence:** none; every new field is optional, old packs import unchanged, and
  drama state and library live in their own app settings (`slurp2.drama.state`, `slurp2.drama.library`).
  Built as designed; the differences are listed under "As built" in `docs/DRAMA.md`.

## 0.3.11 Your relationship, a story-first Stir, Pause all (2026-10-01)

- **Problem:** the player's own couple lived in her public posts only (the chat could not move it,
  her DMs treated the player as a customer, pictures were sold to her partner); Stir stacked ten
  sections with couples, collabs and dramas editable in three places, only one of them with preview
  and Undo, and every persona saw and steered the others' couples and plays.
- **Decision:**
  - The DM answer to the player carries `us` (closer / hurt / madeUp); `modules/projects/slp-player-couple.ts`
    decides whether it counts (days per stage), `features/projects` applies it. Couples gain `secret`.
  - Every change to couples, bonds, collabs, rivalries and drama packs is a Stir play through the one
    runner: new actions `set-bond`, `end-bond` (tie levers), `start-drama`, `end-drama`
    (`features/world/slp-drama-levers.ts`, through the world contract). The ties panels' hooks and the
    drama routes call the same levers.
  - Stir preview, play, undo and the view take the playing persona; plays record it.
  - Fans' DMs to the player's own page are notification events of kind `fan_note`; the player's heart
    and one reply live in the app setting `slurp2.fan-notes`.
  - "Pause all" is a setting kept in step with a process flag in `base/model/slp-pause.ts`; the
    provider and image wrappers and every scheduler check it.
  - `slp-creator-couples.ts` split into `slp-couple-fit.ts` and `slp-couple-read.ts` (size cap).
- **Rejected alternatives:** a model-decided relationship stage (the model only reports the talk);
  keeping the Business and Relationships sheets beside "Now showing" (a second way to change the
  same couple); a DB column for fan-note replies (a migration for one small, capped list).
- **Migration consequence:** none; `secret`, `personaId` on plays, `requestedLead` on the drama state
  and `paused` are optional with safe defaults. Old fan threads to the player's page stay as they are.

## 0.3.13 First run as two chats: G's thread and the Support ticket (2026-10-01)

- **Problem:** a first run passed four surfaces with four looks (splash, age-gate modal with its
  explainer, the Support welcome or the old five-screen tour, the lane choice); the Mari unlock demo
  sat behind "Show me around", and "What's new" was a separate sheet.
- **Decision:**
  - One presentational chat shell, `modules/chrome/SlpChatShell.tsx` (props in, no feature hooks),
    shared by G's thread and the Support ticket. `slurpBubbleSurface` moved there from Messages so a
    module can use it; Messages imports it from the module.
  - G's thread (`features/onboarding/SlpSplash.tsx`, messages from `slp-g-thread.ts`) is the
    first-run welcome and consent, then the changelog with a disabled composer. Backstage opens it
    from a version pill through the new `features/onboarding/slp-onboarding-contract.ts`.
  - The Support ticket (`slp-site-welcome.ts` script, `SlpSiteWelcome.tsx` renderer) replaces the
    age-gate modal, the tour and the lane choice. "Stamp it" is its only write. Stir's Support desk
    shows it as "Your file" and reopens it ("Run setup again") through the onboarding contract.
- **Rejected alternatives:** a generated (AI) welcome (costs before a connection is chosen); a
  server-stored ticket (everything it shows is current settings).
- **Migration consequence:** none; rail progress lives in localStorage, settings are existing fields.
  Design: `docs/ONBOARDING-RAIL.md`.
