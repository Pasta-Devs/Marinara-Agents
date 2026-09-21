# Slurp2 posting intent plan

> **Status: delivered and superseded.** The first overhaul described here shipped. The planner,
> campaigns, picture reuse, Creator strategy, and the continuity ledger that followed are described
> in `docs/POSTING.md`, and the full concept lives in `plan/concept.md` at the repository root.
> This file is kept for the problem statement and the reasoning behind the first fixes.

## The problem

Slurp2 generates intimate moments. It should generate **creator content about**
intimate moments. That missing layer is why the feed reads as artificial.

The feed is not broken because it is staged. An OnlyFans-style post is normally
staged. It is broken because it claims to be candid while using production
conditions nobody in the scene could have produced:

- **No camera source.** The creator is alone, but the image is shot from a low
  floor angle, from overhead, or from across the room. Nothing supplies a
  tripod, a timer, a mirror, or another person. `slp-post-variation.ts`
  `FRAMINGS` hands out "from above, looking down" and "from low, looking up"
  with no way for the scene to pay for them.
- **Every life event becomes a finished post.** A phone call or a glass of
  water always produces one complete photo and one complete caption.
- **Caption and image restate each other.** `buildNoodlerPostMessages` asks one
  model call for `title`, `content`, and `imagePrompt` together, so the picture
  can only ever illustrate the text. `rewriteSlpImagePrompt` then expands that
  into a full production brief: outfit, pose, expression, action, setting,
  lighting, camera, mood. Ambiguity and accident are removed by construction.
- **No visible work.** Creators never mention sets, retakes, scheduled drops,
  previews, requests, editing, wardrobe, boundaries, or older material.
- **Locked posts are not products.** They read as diary entries behind a
  paywall rather than as teasers, sets, callbacks, or custom requests.
- **The variation rotation is visible.** It prevents duplicates, but it gives
  unrelated creators one shared production grammar.

The tester's framing is the goal: Noodle and Slurp must feel like **the same
character posting on two sites with different goals**. Noodle is
character-first and the audience observes. Slurp is audience-first and the
viewer participates. Voice, vocabulary, concerns, and life continuity stay
identical. Only the reason for posting changes.

## Shape of the fix

Two prompt modes, chosen in **Settings -> Prompts**:

- **Classic** — today's behaviour, unchanged, reachable forever.
- **Produce** — the new model, and the shipped default.

Switching modes swaps every prompt and every prompt block in the builder, so
the whole set stays tunable in either mode. Each mode keeps its **own** saved
overrides, so switching never discards work.

Produce mode replaces "a moment, then a photo of it" with an explicit chain:

1. A life event happens (internal, not necessarily posted).
2. The creator decides whether it is postable at all.
3. A **content type** is chosen: teaser, set drop, story, life update, custom
   request, behind-the-scenes, callback, appreciation, boundary/business.
4. A **camera source** is chosen: selfie, mirror, tripod timer, partner,
   screenshot, old photo, gallery repost.
5. An **effort level** is chosen: low, medium, high.
6. The caption is written for its own job — sell, tease, or be casual.
7. The image prompt describes **the photograph**, not the scene, constrained by
   the camera source.

Camera source is the single highest-value constraint. "Simulate a photo taken
by this person holding her phone at chest height" produces a different and far
more credible image than "a woman in a kitchen, warm light".

## Decisions taken

| Question         | Decision                                                                                    |
| ---------------- | ------------------------------------------------------------------------------------------- |
| Scope            | Full system: content types, shoot sessions, production profiles, per-creator tuning         |
| Mode switch      | Settings -> Prompts, not an experiments tab                                                 |
| Default          | Produce mode ships on; classic stays switchable                                             |
| Inventory        | Both modes declare all 18 prompt IDs; the 9 unchanged ones import one shared builder        |
| Marginal prompts | `dmReply`, `commentReply`, `invitedPost` do get produce variants                            |
| Saved edits      | Existing overrides migrate to the classic key untouched; produce starts at its own defaults |
| Block previews   | Live render against a chosen creator, every block including locked ones                     |
| Shoot storage    | A real shoot-sessions table                                                                 |
| Production style | Derived from existing character data, no new authored field                                 |
| Branch           | New branch off `staging`                                                                    |

## Which prompts actually change

Of the 18 IDs in `SLURP_PROMPT_IDS`:

**Diverge (9).** `post`, `postGuidance`, `imagePost`, `imageInterpretation`,
`stageProfile`, `arc`, `dmReply`, `commentReply`, `invitedPost`.

**Identical (9).** `pendingCommission`, `pendingQuestion`, `pendingOpener`,
`pendingDelivery`, `fanActivity`, `reactionBank`, `ambientProfile`,
`conversationSchedule`, `garnishAds`. All fan-side or world-side; neither camera
sources nor content strategy reaches them.

Both modes still **declare** all 18, so the settings panel and the override
store stay symmetric and any prompt can diverge later without a migration. The
9 identical ones import one shared block builder, so exactly one copy of that
text exists.

## Architecture

The existing layering already supports this. `base/prompting` holds the
machinery, `modules/` holds pure deterministic rules, `features/` holds
services. Nothing about the mode split fights that.

### New and changed files

**`base/prompting/`**

- `slp-prompt-modes.ts` — `SLURP_PROMPT_MODES = ["classic", "produce"]`, the
  active-mode resolver, and the per-mode inventory registry.
- `slp-prompt-blocks.ts` — `SLURP_PROMPT_DESCRIPTIONS` and
  `SLURP_PROMPT_EDITABLE_DEFAULTS` become keyed by mode.
  `normalizeSlurpPromptBlockOverrides` gains a mode dimension;
  `composeSlurpPromptBlocks` gains a mode argument. The composition algorithm
  itself does not change.
- `slp-prompt-blocks-shared.ts` — the 9 identical block builders, imported by
  both inventories.

**`modules/feed/`** (pure, deterministic, testable without a model)

- `slp-content-type.ts` — the content-type set and its rotation, mirroring how
  `slp-post-variation.ts` already rotates rather than draws at random, so
  consecutive posts cannot repeat a type.
- `slp-camera-source.ts` — camera sources, which ones a given content type and
  effort level permit, and the prompt text for each.
- `slp-production-profile.ts` — derives a creator's documentary ratio, content
  mix, camera preferences, and effort distribution from the existing character
  card and stage profile. Deterministic on creator id, so two creators differ
  and one creator stays consistent.
- `slp-post-variation.ts` — in produce mode the `FRAMINGS` axis is retired.
  Framing becomes a consequence of the camera source instead of an independent
  instruction. `PLACES`, `MOMENTS`, and `COMPANY` survive.

**`data/feed/`**

- `slp-shoot-storage.ts` — CRUD for shoot sessions.

**`db/schema/slurp.ts`**

- `slurp_shoot_sessions`: id, creatorAccountId, location, outfit, lighting,
  cameraSetup, theme, shotsTaken, shotsUsed, createdAt. Posts reference it by
  `shootId`. Retention follows the existing autopurge rules so old shoots do
  not accumulate.

**`features/feed/`**

- `slp-post-prompt.ts` — split. Produce mode gets its own block builder and,
  critically, **stops asking one model call for caption and image together**.
  The caption is generated first. The image prompt is generated from content
  type, camera source, effort, appearance, and the shoot session — not from the
  caption body.
- `slp-generation-service.ts` — orchestrates the new chain and writes the shoot
  session when a set drop is produced.

**`features/media/`**

- `slp-images-service.ts` and `slp-image-prompt-rewrite.ts` — the rewrite keeps
  identity and style handling, but in produce mode the required output contract
  changes from a full scene brief to a photograph description anchored on the
  camera source. Existing identity protection is untouched.

**`features/settings/`**

- `slp-settings-routes.ts` — `/settings/prompt-blocks` takes a mode parameter.
  New `POST /settings/prompt-blocks/preview` renders one composed block, or a
  whole prompt, against a chosen creator.

**`modules/settings/slp-settings.ts`**

- `promptMode: z.enum(["classic", "produce"])`, default `"produce"`.
- `promptBlocks` becomes `Record<mode, overrides>`. The normalizer accepts the
  old flat shape and lifts it into `{ classic: <old> }`, so an upgrading user
  loses nothing.

**Client `features/settings/`**

- `SlpPromptsPanel.tsx` — the mode switch, with a clear statement that each mode
  keeps its own tuning.
- `SlpPromptBlockBuilder.tsx` — a preview control on every block, locked ones
  included, plus a creator picker for the preview context.

### The live preview and identity

The preview route runs the same `protectCreatorGeneratedIdentity` path the
generator uses. A Secret Creator's real details must not reach the settings
panel through a preview. This is a trust boundary and does not get simplified
away. The route is read-only and makes no model call: it composes and returns
text.

## Content types

| Type                | Caption job                               | Image job                                    |
| ------------------- | ----------------------------------------- | -------------------------------------------- |
| Teaser              | Short, enticing, points at locked content | Cropped or alternate angle from the real set |
| Set drop            | Introduces theme; may mention the work    | High effort, intentional styling             |
| Story               | Minimal or absent                         | Phone quality, casual framing                |
| Life update         | Longer, personal, non-sexual              | Optional, casual, clothed                    |
| Custom request      | Names the request pattern                 | Delivers what was asked                      |
| Behind the scenes   | Discusses making the content              | Setup, outtake, or failure visible           |
| Callback            | References earlier content                | Same location, outfit, or shoot              |
| Appreciation        | Direct gratitude to subscribers           | Warm, eye contact                            |
| Boundary / business | Limits, schedule, absence                 | Optional, neutral                            |

Not every event becomes a post. Produce mode allows text-only posts, reposted
old material, and skipped days.

## Shoot sessions

A set drop writes a shoot session. The next two to four posts may draw from it:
same outfit, location, and lighting, with the caption acknowledging the gap
("one more from yesterday"). This is what produces credible staging instead of
a creator who teleports through four cinematic locations in one afternoon.

## Voice continuity with Noodle

**Assumption, flagged for confirmation:** this branch changes Slurp2 only.
Voice continuity comes from the shared source character card that both packages
already read, so the same person survives across both feeds without a new
cross-package dependency. Cross-platform references ("tweeted about it
earlier") and genuinely shared mood state are a later, separate piece of work.

What must stay identical across both: vocabulary, sentence rhythm, emoji use,
punctuation habits, humour, interests, relationships, and ongoing life
situations. What changes: why they are posting, and who they are posting for.

## Delivery shape

**One branch, one PR: a complete experimental platform voice and feel
overhaul.** Produce mode lands whole, not in slices. The stages below are the
commit order inside that PR, chosen so each commit builds, passes the baseline
gates, and can be reviewed on its own. They are not separate pull requests.

The PR is experimental by construction: classic mode stays reachable and
byte-identical to today's behaviour, so the overhaul can be judged against the
thing it replaces without a revert.

## Commit order

1. **Mode plumbing.** `promptMode` setting, per-mode overrides with the classic
   migration, mode-aware compose, mode switch in the panel. Produce mode
   initially identical to classic, so this phase changes no output.
2. **Camera source.** Camera sources, the produce `imagePost` and
   `imageInterpretation` variants, framing retired from the variation rotation.
   Largest realism gain for the least code.
3. **Caption/image decoupling.** Two model calls. The image prompt stops seeing
   the caption body.
4. **Content types.** The type set, its rotation, and the produce `post` and
   `postGuidance` variants.
5. **Shoot sessions.** Table, storage, batch continuity, callbacks.
6. **Production profiles.** Derived per-creator style, so creators stop sharing
   one grammar. Produce variants for `stageProfile` and `arc`.
7. **Conversation surfaces.** Produce variants for `dmReply`, `commentReply`,
   `invitedPost`.
8. **Block previews.** Preview route and per-block preview UI.

The PR is only ready when all eight are in. A partial produce mode is worse
than classic: a feed with camera sources but no content types still turns every
glass of water into a finished post.

## Validation

Baseline, every phase:

```
npm run check
node scripts/test-catalog-lanes.mjs
node scripts/validate-package-locales.mjs
node scripts/validate-catalog.mjs
node scripts/tests/catalog-release-notes.regression.mjs
```

New regression coverage:

- `tests/slurp-prompt-blocks.regression.ts` — extend to assert both modes
  declare all 18 IDs, that the shared 9 are reference-identical between modes,
  and that a flat legacy override object normalizes into the classic key with
  nothing lost.
- `tests/slurp-camera-source.regression.ts` — every content type and effort
  combination yields a permitted camera source; no produce-mode image
  instruction emits an unsourced angle.
- `tests/slurp-content-type.regression.ts` — the rotation never repeats a type
  on consecutive posts, and two creators do not march in lockstep.
- `tests/slurp-production-profile.regression.ts` — the derivation is
  deterministic per creator and distinct across creators.

Each commit adds only the smallest runnable proof for the logic it introduces.
The full set must pass before the PR leaves draft.

Security-sensitive notes required at PR time: the preview route is new surface
that renders creator context, so its identity-protection behaviour needs an
explicit validation note. No change to package permissions, archive handling,
install/update behaviour, or Engine snapshots is planned.

The branch needs one package rebuild and catalog entry rebuild, and a
`packages/slurp2/CHANGELOG.md` entry. Version bumps are patch only, set in
`build-feature-packages.mjs`.

## Manual test

Generate 30 posts per mode for the same creator and compare:

- **Immersion.** Did any moment break belief that this person exists? Watch for
  unsourced camera angles and repeated production grammar.
- **Platform authenticity.** Does this read as a real creator page — strategy,
  monetization awareness, visible work?
- **Voice continuity.** Read five Noodle posts and five Slurp posts. Same
  person?
