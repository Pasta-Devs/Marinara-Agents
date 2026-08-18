# NoodleR Working Implementation Plan

This plan replaces the former concept backlog. It describes small, ordered
issues and pull requests rather than one NoodleR rewrite. No phase is authorized
for implementation merely by appearing here.

Before implementing any phase, confirm or open its issue, make ownership
visible, work from `staging`, and open a draft pull request targeting `staging`
when work begins. Follow `AGENTS.md`, `CONTRIBUTING.md`, and
`.github/agents/chai-workflow.md`. Never hand-edit generated bundles, artifacts,
catalogs, hashes, or checksums.

## Product principles

- NoodleR is a fun, local, single-player creator-feed roleplaying feature tied
  to the existing Noodle world.
- Optimize for character moments, a lively fictional world, ease of use, and
  memorable interactions rather than economic realism or business management.
- Creators, viewers, fans, subscriptions, unlocks, prices, and payments are
  simulated roleplay state controlled by the player.
- Preserve character voice. NoodleR may have an adult-first tone without making
  every Creator sound alike or every post explicit.
- Keep ordinary choices playful and understandable. Put provider, scheduler,
  diagnostic, and fine-grained generation controls behind advanced surfaces.
- Prefer a conservative volume of specific posts and recurring interactions to
  a large amount of filler.
- Identity disclosure and post access are separate roleplay rules, not security,
  privacy, authentication, or real access-control boundaries.
- Preserve viewer-persona scoping because persona-specific follows,
  subscriptions, unlocks, conversations, and notifications create useful
  roleplay differences.

## Confirmed decisions

- **Hinted is a recognizable open secret.** It is the same person under a stage
  name. Appearance, interests, routines, selected life details, and enabled
  source image references may carry over. Exact source names and handles must
  not be used, and guesses must not be explicitly confirmed. Hinted does not
  promise privacy or anonymity.
- **Default tone is adult-first variety.** Flirty, suggestive, teasing, and
  sensual posts should be common. Explicit posts should appear regularly when
  appropriate to the Creator, but are not mandatory or necessarily the
  majority. Ordinary updates, humor, projects, and character continuity remain
  important.
- **Per-Creator intensity belongs in advanced settings.** New Creators use a
  balanced default; onboarding does not require an intensity decision.
- **Preserve the current onboarding structure.** Keep its teaching sequence and
  Easy/Customize fork. Tune copy, defaults, navigation, and handoff rather than
  replacing it with a short linear wizard.
- **Bulk onboarding remains character-focused.** Give the active persona a
  separate, prominent, optional `Create my Creator profile` path instead of
  mixing player personas into the character bulk list.
- **Keep Lively as the default pace:** at most four automatic posts per day
  across the entire Creator cast. Retain Occasional and Manual choices. Do not
  scale the rate silently with Creator count.
- **Automatic publishing should create a character-aware public/locked mix.**
  Use the post concept, Creator intensity, and recent feed balance rather than a
  visible fixed ratio.
- **Do not create a formal public-teaser/locked-follow-up model.** Locked cards
  already provide teaser presentation. A locked post may loosely continue a
  recent public post without linkage metadata or coupled lifecycle rules.
- **Fictional prices are presentation, not an economy.** Show prices in unlock
  and subscription confirmation, hide wallet balance, and add no affordability,
  refill, earnings, or budget-management loop.
- **Creator replies should be explicit but lively.** The comment composer offers
  `Ask for a reply`, enabled by default. Disabling it posts without a provider
  request.
- **Synthetic fans should become a small recurring cast** with stable identity,
  lightweight traits, Creator preferences, and limited evolving familiarity.
- **The first Noodle/NoodleR crossover is rare random speculation about a Hinted
  Creator.** It must never explicitly confirm the identity and must be strongly
  frequency- and repetition-limited.
- **Notifications use a deliberately quiet local activity panel.** Direct
  Creator replies may create individual items. Followed-Creator posts and
  subscriber activity are bundled. Routine fan activity, unlocks, and automatic
  publishing remain silent. History is bounded and read state is persona-scoped.
- **Private Creator/viewer messages are committed larger work,** but their access
  rules are intentionally unresolved and are not a pressing action.

## Current implementation audit

Already implemented behavior that should not be planned as new work:

- Four-screen teaching intro, Easy/Customize setup lanes, activity presets, a
  shared daily posting ceiling, optional first-post generation, completion
  states, and a skippable Pastapay joke.
- Persona-scoped follows, subscriptions, individual unlocks, and feed access.
- Subscribing follows a Creator; unsubscribing and unfollowing remain separate
  actions.
- Locked cards provide a blurred teaser treatment.
- Synthetic fan activity includes locked posts while withholding their hidden
  body from generation; fans can react only to supplied safe context such as the
  title and locked status.
- Creator replies are generated after viewer-persona comments today, although
  the provider request is implicit rather than player-visible.
- Most visible English copy already says `Creator profile`. Many internal types,
  routes, compatibility fields, and localization keys still contain `stage` and
  should not be renamed solely for cosmetic consistency.
- Individual Creator source selection supports characters and personas. Bulk
  onboarding intentionally queries characters only.

Behavior that remains missing or materially incomplete:

- English UI and README disclosure copy contradict the authored open-secret
  Hinted prompts and image-reference behavior.
- Onboarding and README maturity claims contradict the stored default generation
  guidance.
- README fan-activity claims incorrectly exclude locked posts.
- Automatic publishing releases locked posts only.
- Prices are absent from the unlock decision even though access actions exist.
- Fan snapshots do not yet form a durable recurring cast with relationship
  continuity.
- There is no quiet activity inbox, rare Hinted speculation event, or private
  Creator/viewer messaging.

## Immediate fixes

### Phase 1A — Align the Hinted product contract

- **User-facing outcome:** Hinted is described everywhere as a recognizable open
  secret, matching profile, post, reply, and image generation.
- **Roleplay value:** Players can choose Hinted for identity speculation and
  crossover stories without being falsely promised non-identifying output.
- **Likely source areas:** package README; English Noodle UI catalog;
  `NoodlerBulkCreatePanel.tsx`; disclosure/profile surfaces; disclosure and image
  generation tests or fixtures. Preserve internal compatibility names.
- **Dependencies:** confirmed Hinted decision.
- **Edge cases:** no exact source name/handle; no explicit confirmation of a
  guess; recognizable appearance may carry over; changing to Secret still
  requires identifying published material and avatars to be reviewed; existing
  translated strings may be partial and fall back to English.
- **Validation:** focused disclosure prompt and image-reference tests; UI copy
  review across onboarding and management; package locale validation; baseline
  repository validation.
- **Generated outputs:** yes, if executable UI/source or package payload changes;
  rebuild Noodle through the feature-package builder. README-only edits do not.
- **Size:** small.

### Phase 1B — Align the default maturity guidance

- **User-facing outcome:** onboarding, README, editable default guidance, and
  generation behavior all describe adult-first variety consistently.
- **Roleplay value:** the feed feels distinctively NoodleR while preserving shy,
  romantic, funny, mundane, and other character-specific moments.
- **Likely source areas:** server storage defaults and migration comparison;
  matching client default constant; onboarding copy; package README; generation
  evaluator samples if expectations change.
- **Dependencies:** confirmed adult-first-variety decision.
- **Edge cases:** preserve user-customized guidance; migrate only an exact prior
  shipped default; avoid forcing explicit content; retain the adults-only
  premise; do not silently overwrite a locally edited value.
- **Validation:** tests for fresh defaults, exact-default migration, and custom
  guidance preservation; representative saved-output evaluation; locale and
  baseline repository validation.
- **Generated outputs:** yes; rebuild Noodle.
- **Size:** small.

### Phase 1C — Correct stale fan and access copy

- **User-facing outcome:** documentation and UI accurately say that released
  public and locked posts can receive synthetic activity, while locked bodies
  remain excluded from fan prompts.
- **Roleplay value:** players can trust what automation will do and understand
  why reactions to locked titles do not reveal hidden content.
- **Likely source areas:** package README; English UI catalog; fan-activity help
  and diagnostics copy.
- **Dependencies:** none.
- **Edge cases:** unreleased reserve posts remain ineligible; hidden body and
  original locked media must not enter fan prompts; disabled audience activity
  must remain silent.
- **Validation:** prompt projection tests for public and locked posts; copy audit;
  package locale and baseline repository validation.
- **Generated outputs:** only if executable UI/locales change; rebuild then.
- **Size:** small.

### Phase 1D — Finish the visible terminology and behavior audit

- **User-facing outcome:** remaining visible `Stage profile`, stale beta, public-
  only eligibility, subscription/follow, and persona-switch messages are either
  corrected or documented as intentionally retained terms such as `Stage voice`.
- **Roleplay value:** controls read like one coherent playful product rather than
  exposing implementation history.
- **Likely source areas:** English UI catalog; NoodleR components; package README.
- **Dependencies:** Phases 1A–1C establish canonical wording.
- **Edge cases:** do not rename storage fields, route paths, shared types, or
  localization keys without a compatibility reason; unsubscribing must not imply
  unfollowing; persona changes must visibly refresh scoped state.
- **Validation:** targeted string search; subscription/follow and persona-switch
  tests; locale and baseline repository validation.
- **Generated outputs:** likely yes; rebuild Noodle.
- **Size:** small.

## Small improvements

### Phase 2A — Polish onboarding without restructuring it

- **User-facing outcome:** the existing intro and Easy/Customize flow keep their
  personality but use corrected disclosure/maturity copy, reliable navigation,
  clear fictional-payment language, and a direct handoff to the populated feed.
- **Roleplay value:** setup remains fun and explanatory while reducing confusion
  before the first character moment.
- **Likely source areas:** `NoodlerAgeGate.tsx`;
  `NoodlerBulkCreatePanel.tsx`; `NoodlerHome.tsx`; English UI catalog; onboarding
  completion hooks.
- **Dependencies:** Phase 1 copy contracts.
- **Edge cases:** Skip Intro versus Skip Setup; zero eligible characters; partial
  creation or generation failure; settings-save failure; retry idempotency;
  reduced motion; selection-only reuse; mobile layout.
- **Validation:** component/flow tests for both lanes and all completion states;
  manual verification of age-gate skip and feed handoff when implementation is
  authorized; locale and baseline repository validation.
- **Generated outputs:** yes; rebuild Noodle.
- **Size:** medium.

### Phase 2B — Add the active persona’s Creator entry point

- **User-facing outcome:** a clear `Create my Creator profile` or `My Creator
  profile` destination appears for the active persona, separate from character
  bulk creation.
- **Roleplay value:** the player can move naturally between browsing as a viewer
  and acting as their persona’s Creator without confusing that role with
  autonomous character setup.
- **Likely source areas:** `NoodlerHome.tsx`; Noodle shell/navigation; existing
  source picker and profile draft flow; English UI catalog.
- **Dependencies:** existing individual persona-source support; no bulk schema
  change required.
- **Edge cases:** no active persona; persona already has a Creator; hidden own
  profile; switching personas with unsaved edits; source deletion or revision.
- **Validation:** navigation and existing-profile tests; persona-switch tests;
  manual viewer/creator handoff; locale and baseline validation.
- **Generated outputs:** yes; rebuild Noodle.
- **Size:** small.

### Phase 2C — Show flavor prices without exposing an economy

- **User-facing outcome:** unlock and subscription sheets show clear fictional
  prices and simulated-payment language; wallet balance remains hidden.
- **Roleplay value:** subscribing versus unlocking feels like an intentional
  in-world choice without budgets, replenishment, or management failure states.
- **Likely source areas:** `NoodlerPostCard.tsx`; profile subscription actions;
  shared view models or deterministic presentation helpers; English UI catalog.
- **Dependencies:** decide whether price is deterministic presentation or stored
  post/profile flavor metadata during issue refinement. It must never gate access
  on funds.
- **Edge cases:** stable price display across refreshes; locale formatting;
  subscribe versus single unlock; already subscribed/unlocked; demo card; no
  implication of real billing.
- **Validation:** UI tests for both actions and existing access states; route tests
  proving no wallet debit or insufficient-funds path; locale and baseline
  validation.
- **Generated outputs:** yes; rebuild Noodle.
- **Size:** small if deterministic, medium if stored metadata is chosen.

### Phase 2D — Make Creator reply requests visible

- **User-facing outcome:** the comment composer includes `Ask for a reply`, on by
  default, with clear pending and partial-failure feedback.
- **Roleplay value:** conversations stay immediate while the player understands
  and controls when an additional model request is made.
- **Likely source areas:** `NoodlerPostCard.tsx`; `NoodlerHome.tsx`; Noodle hooks;
  English UI catalog. Existing reply route and operation should be reused.
- **Dependencies:** none.
- **Edge cases:** comment succeeds but generation fails; toggle off; duplicate
  submission; reply ceiling exhausted; missing connection; locked-post access;
  persona switch during a pending request.
- **Validation:** component tests for toggle states and partial failure; route
  regression tests; manual comment/reply exercise; locale and baseline
  validation.
- **Generated outputs:** yes; rebuild Noodle.
- **Size:** small.

### Phase 2E — Add one-click quieter behavior

- **User-facing outcome:** a prominent `Make NoodleR quieter` action changes
  Lively to Occasional, then allows Manual through normal settings. The default
  remains four posts per day across all Creators.
- **Roleplay value:** players can calm a busy world immediately without learning
  scheduler controls or per-Creator rates.
- **Likely source areas:** NoodleR feed/settings surfaces; settings mutation hook;
  English UI catalog.
- **Dependencies:** existing activity presets and global daily ceiling.
- **Edge cases:** already Occasional or Manual; pending setting save; per-Creator
  overrides; clear confirmation of the resulting pace.
- **Validation:** settings transition tests; failure feedback; locale and baseline
  validation.
- **Generated outputs:** yes; rebuild Noodle.
- **Size:** small.

## Larger feature work

### Phase 3A — Character-aware automatic public/locked publishing

- **User-facing outcome:** scheduled Creators publish a useful mixture of public
  and locked posts instead of every automatic post being locked.
- **Roleplay value:** unsubscribed personas see enough character activity to
  become interested, while locked content retains its payoff.
- **Likely source areas:** NoodleR generation response/schema; reserve preparation
  and finalization; scheduler; recent-history prompt context; feed projections;
  English automation copy.
- **Dependencies:** Phase 1 maturity contract. Intensity should be accepted as an
  optional later input, not required for the first version.
- **Edge cases:** avoid long all-public or all-locked streaks without enforcing a
  visible ratio; preserve manual access choice; retries must not change access
  unexpectedly; reserve posts retain decided access; locked media protection;
  first posts; sparse history.
- **Validation:** deterministic selection-policy tests; generation parsing and
  fallback tests; reserve/retry/restart tests; public and locked access tests;
  representative generation evaluation; manual scheduled publishing; locale and
  baseline validation.
- **Generated outputs:** yes; rebuild Noodle and include generated package and
  catalog outputs.
- **Size:** medium.

### Phase 3B — Per-Creator content intensity

- **User-facing outcome:** advanced Creator settings offer a small set of clear
  intensity levels, with a balanced default and no onboarding requirement.
- **Roleplay value:** different Creators can be teasing, spicy, or explicit
  without rewriting global prompt guidance or homogenizing the cast.
- **Likely source areas:** shared Creator settings schema; storage normalization
  and migration; profile management UI; post and reply prompts; automatic access
  selection; English UI catalog.
- **Dependencies:** exact labels and prompt semantics should be finalized in the
  phase issue; Phase 1B establishes the balanced default.
- **Edge cases:** missing legacy value; custom global guidance; character voice
  overrides intensity; manual post direction; non-explicit Creator concepts;
  intensity must not weaken identity-disclosure rules.
- **Validation:** schema/migration tests; prompt matrix across intensity and
  disclosure; UI persistence tests; generation evaluation; locale and baseline
  validation.
- **Generated outputs:** yes; rebuild Noodle.
- **Size:** medium.

### Phase 3C — Loose narrative follow-ups

- **User-facing outcome:** an occasional locked post may naturally allude to a
  recent public post without displaying a formal link or duplicate teaser card.
- **Roleplay value:** feeds gain short story arcs without introducing paired-post
  management.
- **Likely source areas:** recent-post prompt context; generation guidance;
  repetition/novelty checks.
- **Dependencies:** Phase 3A public/locked mix.
- **Edge cases:** deleted or edited prior post; private body leakage; repetitive
  callbacks; stale events; no suitable recent public post.
- **Validation:** prompt-context tests; locked-body projection tests; sample
  evaluation for repetition and unsupported references; baseline validation.
- **Generated outputs:** yes; rebuild Noodle.
- **Size:** medium.

### Phase 4A — Persistent recurring fan cast

- **User-facing outcome:** a modest set of recurring fans has stable names,
  handles, traits, preferred Creators, and limited familiarity that can support
  running jokes and recognizable relationships.
- **Roleplay value:** audience reactions feel like people in the fictional world
  rather than disposable archetype labels.
- **Likely source areas:** fan identity provider; storage schema and lifecycle;
  fan activity planning, prompts, and projections; management/debug UI; backup
  and uninstall behavior.
- **Dependencies:** define bounded cast size, trait schema, and familiarity limits
  in the phase issue. Existing archetype weights remain internal inputs.
- **Edge cases:** account/profile deletion; handle uniqueness; bounded growth;
  duplicate reactions; favorites becoming repetitive; Creator visibility;
  locked-body exclusion; backup/restore; migration from snapshot-only activity.
- **Validation:** migration and retention tests; deterministic selection limits;
  prompt safety tests; restart/backup/uninstall checks; representative continuity
  evaluation; locale and baseline validation.
- **Generated outputs:** yes; rebuild Noodle. Storage work is security-sensitive
  and needs explicit validation notes.
- **Size:** large.

### Phase 4B — Quiet persona-scoped activity panel

- **User-facing outcome:** viewer personas can revisit direct Creator replies and
  low-frequency summaries of followed-Creator posts and subscriber activity.
- **Roleplay value:** meaningful developments are not lost in a lively feed, but
  routine activity does not become notification noise.
- **Likely source areas:** notification storage and retention; viewer projections;
  NoodleR navigation and activity UI; reply, publishing, follow, and subscription
  event integration.
- **Dependencies:** event taxonomy and bundling windows finalized in the issue;
  can precede persistent fans because routine fan activity is excluded.
- **Edge cases:** per-persona read state; persona switching; bounded history;
  deleted posts/Creators; bundle updates; offline scheduler catch-up; mark all
  read; own Creator events.
- **Validation:** event eligibility and bundling tests; retention and migration;
  persona isolation; restart/offline behavior; UI accessibility; locale and
  baseline validation.
- **Generated outputs:** yes; rebuild Noodle. New storage requires explicit
  lifecycle and uninstall notes.
- **Size:** large.

### Phase 4C — Rare Hinted-identity speculation event

- **User-facing outcome:** on rare occasions, Noodle followers notice clues and
  speculate about a Hinted Creator without confirmation.
- **Roleplay value:** Hinted produces an occasional story payoff connecting both
  social surfaces rather than acting only as a settings label.
- **Likely source areas:** Noodle/NoodleR crossover scheduler or event planner;
  Hinted candidate selection; safe prompt context; public Noodle post/activity
  creation; repetition history.
- **Dependencies:** Phase 1A canonical Hinted semantics. Persistent fans are not
  strictly required, but stable actors improve continuity.
- **Edge cases:** never use exact prohibited identifiers or confirm the guess;
  exclude Secret Creators; avoid excessive frequency; avoid leaking locked body
  or media; handle disclosure changes and deleted profiles; no event when context
  is weak.
- **Validation:** positive Hinted and negative Open/Secret eligibility tests;
  frequency and cooldown tests; prompt redaction tests; restart/idempotency;
  representative adversarial generation evaluation; baseline validation.
- **Generated outputs:** yes; rebuild Noodle.
- **Size:** large.

### Phase 5 — Private Creator/viewer messages

- **User-facing outcome:** a viewer persona and Creator can hold a local private
  roleplay thread, potentially including locked posts or media later.
- **Roleplay value:** direct conversation creates deeper character scenes than
  additional management metrics.
- **Likely source areas:** new message/thread storage; routes and viewer scoping;
  NoodleR navigation; generation prompts and context limits; media access;
  notification integration; backup and uninstall lifecycle.
- **Dependencies:** access and initiation rules remain unresolved; complete the
  pressing phases before issue refinement. Phase 4B should provide notification
  primitives.
- **Edge cases:** persona isolation; Creator/source identity rules; unsubscribe or
  visibility changes; deletion; blocked/hidden profiles; context growth; locked
  media authorization; provider disclosure; restart and offline behavior.
- **Validation:** threat-oriented access tests; persona isolation; context and
  prompt-safety tests; migration, backup, restart, and uninstall; manual thread
  exercise; locale and baseline validation.
- **Generated outputs:** yes; rebuild Noodle. This is executable, storage, and
  access-sensitive work requiring explicit validation notes.
- **Size:** large.

## Later experiments

These remain ideas, not scheduled phases:

- Manual Creator promotion of a NoodleR post on Noodle.
- Broader Noodle-event context in NoodleR generation, with strict repetition
  limits.
- Character-specific subscriber greetings or welcome messages.
- Expressive simulated tips without balances, affordability, or earnings.
- Lightweight viewer requests to Creators.
- Private locked media inside messages, only after the base message access model
  is proven.
- Audience mood presets such as Quiet, Friendly, Chaotic, and Thirsty, while
  retaining detailed archetype weights only for advanced use.

## Rejected or deferred ideas

- Replacing onboarding with a short linear setup: rejected; preserve and polish
  the current teaching flow and Easy/Customize choice.
- Adding personas to the character bulk-selection list: rejected; provide a
  separate active-persona Creator path.
- A formal public-teaser/locked-follow-up content type: rejected; locked cards
  are already teasers. Loose narrative continuity is sufficient.
- A fixed public/locked ratio visible to players: rejected in favor of
  character-aware selection and recent-feed balance.
- A real or consequential wallet, insufficient-funds state, refills, earnings,
  tiers, bundles, trials, or business metrics: deferred unless they later prove
  fun independently of administration.
- Operating-system notifications and elaborate notification preferences:
  rejected for the planned quiet local activity panel.
- Renaming internal `stage` compatibility identifiers solely to match visible
  `Creator profile` copy: rejected as needless migration risk.
- Detailed private-message access rules: deferred until the phase is ready for
  issue refinement.

## Known inconsistencies

- Hinted is open-secret behavior in authored generation and image source, but
  current README and English UI copy describe non-identifying inspiration and
  prohibit source references.
- The shipped generation-guidance default makes explicit content dominant,
  while onboarding and README say mature content is not default.
- README says automatic fan activity excludes locked posts; authored server
  behavior safely includes them without sending the hidden body.
- Automatic publishing copy and behavior are locked-only, contrary to the
  confirmed public/locked mixture.
- The product contract supports character and persona Creators, while bulk
  onboarding selects characters; this is now intentional but needs the separate
  active-persona entry point to be clear.
- Creator reply generation is currently implicit after every comment; the
  planned composer control will make the request visible.
- A large stored wallet exists, but the confirmed product direction hides the
  balance and treats prices as non-gating flavor.

## Validation requirements

For every implementation phase:

1. Link or open an issue before implementation, confirm an owner and branch from
   current `staging`, then open a draft PR targeting `staging` when work begins.
2. State the package behavior or invariant being proven and list positive,
   negative, failure, restart, and lifecycle cases relevant to the phase.
3. Edit authored source under `packages/noodle/src/` and source documentation;
   never hand-edit `client.js`, `server.mjs`, ZIP artifacts, catalogs, hashes,
   checksums, or sizes.
4. When source payloads change, rebuild only Noodle with:

   ```bash
   node scripts/build-feature-packages.mjs noodle
   ```

5. Run the repository baseline:

   ```bash
   node scripts/test-catalog-lanes.mjs
   node scripts/validate-package-locales.mjs
   node scripts/validate-catalog.mjs
   git diff --check
   ```

6. Run focused tests for the changed prompts, storage, access projection,
   scheduler, UI flow, or migration. Use
   `node scripts/evaluate-noodle-generation.mjs` with representative saved model
   output when generation behavior changes; the repository fixture alone is not
   model-quality evidence.
7. Manually install or update the package in a compatible Engine staging checkout
   and exercise only the relevant supported paths when implementation is ready
   for review. Report exactly what was performed, including proof gaps.
8. Treat executable client/server changes, new storage, access/media behavior,
   schedulers, Engine snapshots, and generated archives as security-sensitive and
   include explicit validation notes.
9. Never auto-check human verification boxes and never claim manual testing,
   package installation, CI, or review that did not occur.

## Recommended issue and PR order

1. Phase 1A — Hinted contract alignment.
2. Phase 1B — maturity-default alignment.
3. Phases 1C and 1D — stale copy and terminology/behavior audit; combine only if
   the issue remains small and focused.
4. Phase 2A — onboarding polish.
5. Phase 2B — active-persona Creator entry point.
6. Phases 2C–2E — independent small UX improvements, each eligible for its own
   issue and PR.
7. Phase 3A — automatic public/locked mixture.
8. Phases 3B and 3C — intensity, then loose continuity.
9. Phase 4A — recurring fan cast.
10. Phase 4B — quiet activity panel.
11. Phase 4C — rare Hinted speculation crossover.
12. Phase 5 — private messages, only after a dedicated access-design decision.
