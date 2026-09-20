# Slurp Content Planner and Continuity

## Status

This document is the approved concept and implementation plan for the next Slurp2
voice and feel overhaul.

It covers:

- the product behavior;
- the shared Creator continuity foundation;
- the durable Content Planner;
- Slurp message integration;
- the profile and Backstage controls;
- migration from the current Classic runtime mode;
- the sliced commit order;
- regression, migration, and live validation.

## Branch Workflow

All twelve slices land on the long-lived integration branch `producing-content`.

- `producing-content` starts from the current working state on `staging`.
- Each slice is its own short-lived working branch and its own pull request into
  `producing-content`.
- Each slice PR bumps one patch version and rebuilds the package, so every slice is
  installable on a dev Engine.
- When all slices are complete, one pull request promotes `producing-content` into
  `staging` as Slurp2 `0.2.0` with a single `0.2.0` changelog entry.
- `0.2.0` is a deliberate minor bump. It is an exception to the patch-only rule.

The current worktree contains unrelated user changes. Implementation must preserve
them.

## Product Goal

Slurp is an adult Creator platform. It is not Noodle with locked posts.

The same source Character or Persona must remain recognisable across surfaces. The
voice, identity, interests, humour, relationships, boundaries, and ongoing facts
must remain coherent. The reason for posting changes because the platform changes.

Noodle is character-first and public-facing. The audience observes a person posting
their life.

Slurp is Creator-first and audience-aware. A Creator chooses what to publish, what
to sell, what to tease, what to make for subscribers, what to reuse, and what not to
show.

The target feeling is:

> This is the same person on a different platform, with a different reason for
> posting.

Slurp must simulate the Creator's editorial and production decisions, not only a
moment that happened and an image that illustrates it.

## Current State

The first posting-intent overhaul already provides these foundations:

- Produce generation is the default runtime.
- Camera sources constrain image framing.
- Caption and image-brief generation are decoupled.
- Content types exist for teaser, story, set, life, request, production,
  callback, appreciation, and boundary.
- Shoot sessions support limited callback reuse.
- Production profiles vary camera preference, effort, and production transparency.
- Slurp message and reply prompts know about performed intimacy.
- Prompt blocks can be previewed against a Creator.
- Weighted deterministic choices replaced fixed rotation in the new Produce path.

The current implementation is not yet the complete system described here.

Important gaps:

- Classic still exists as a runtime prompt mode.
- There is no durable Content Planner before generation.
- Content intent and delivery method are mixed together.
- There is no deliberate chosen-skip outcome.
- Text-only is mostly a fallback, not a deliberate delivery choice.
- Shoot records do not contain a complete production session.
- Requests do not have a full fulfill, tease, decline, delay, ignore, and aggregate
  workflow.
- Creator production profiles are derived from account identity and are not editable.
- Message state and Creator continuity are not connected through a typed event bridge.
- Slurp has no durable, reviewable Creator continuity editor.
- Existing Slurp media is not a first-class archive and repost source.
- There is no linked teaser, set, and callback campaign object.

## Design Decisions

### One Produce Engine

Produce is the only runtime posting engine after this PR.

The user does not choose between Document, Mixed, and Produce modes. Those names
describe internal behavior and evaluation language, not three competing products.

The planner can still choose documentary behavior, produced behavior, or a mixture
for one Creator. It does this through intent, delivery, effort, media age, and
workflow state.

The old Classic runtime behavior is removed.

### Classic Prompt Preset

The old prompt text survives as a selectable **Classic prompt preset**.

It is not a runtime generation mode.

Migration behavior:

1. Existing flat prompt overrides migrate into matching Produce prompt blocks when
   the block has a direct equivalent.
2. Incompatible old blocks use the shipped Produce default.
3. The old prompt text and compatible old edits are saved as the Classic prompt
   preset.
4. The preset can be selected to restore old prompt wording or use it as a starting
   point for editing.
5. Selecting the preset does not restore the old camera, scheduler, image, or
   posting algorithm.

This preserves user work without preserving the behavior that this PR replaces.

### Separate Axes

The planner uses separate axes. One large content-type list must not mix purpose,
media, access, and workflow state.

#### Intent: why the Creator posts

The first intent set is:

- `casual` — a low-pressure ordinary update or connection post;
- `teaser` — a public preview that sells access without resolving the payoff;
- `set` — a planned premium shoot or content drop;
- `behind_the_scenes` — visible work, setup, retakes, outtakes, editing, or failure;
- `request` — a response to a subscriber request or demand trend;
- `appreciation` — gratitude and retention without turning every thank-you into a
  sale;
- `callback` — a continuation of an earlier post, shoot, or campaign;
- `business` — schedule, pricing, availability, boundaries, absence, or delay.

Story and repost are delivery methods, not intents. They can be combined with a
casual, teaser, callback, appreciation, or request intent.

Absence is a business intent. Delay is a workflow state and may produce a business
post or a message follow-up.

#### Delivery: how the content is delivered

The first delivery set is:

- `text_only` — no media by intent, even when image generation is available;
- `new_capture` — a new selfie, mirror, timer, partner, or screenshot capture;
- `existing_media` — a real prior Slurp image or shoot asset;
- `story` — an ephemeral-style presentation;
- `multi_image_set` — one post containing several related media files;
- `cropped_preview` — a preview crop or alternate preview linked to paid content.

The current camera-source rules remain inside `new_capture`.

#### Workflow: what happens to the opportunity

The workflow state is separate from the post itself:

- `planned`;
- `publish`;
- `text_only`;
- `reuse_media`;
- `fulfill`;
- `tease`;
- `delay`;
- `decline`;
- `ignore`;
- `skip`;
- `cancelled`;
- `completed`.

Not every workflow state creates a feed post. A chosen skip consumes the automatic
slot and creates no post, image, charge, retry, or false failure.

### Durable Content Planner

Every automatic post slot passes through the Content Planner.

The planner creates or resolves a durable content opportunity before model
generation. Generation is a later step that executes the selected opportunity.

The planner decides:

1. Whether this slot should publish or be a chosen skip.
2. Whether the post is casual, produced, a campaign stage, a request response, a
   business update, or a callback.
3. Whether the post is text-only, a new capture, existing media, a Story, a
   multi-image set, or a cropped preview.
4. Whether the opportunity is public, locked, subscriber-only, or PPV according to
   existing Slurp access rules.
5. Whether the opportunity starts, consumes, or continues a shoot or campaign.
6. Whether a message request is fulfilled, teased, delayed, declined, ignored, or
   aggregated.
7. Which approved continuity facts and active events are relevant.

The planner is deterministic at the business boundary. It may use weighted rules
for variety, but it stores the selected decision so a retry does not make a
different decision.

The model writes the Creator's voice and the post text. It does not decide whether
the system charges a user, creates a campaign stage, consumes a shoot asset, or
marks a slot as skipped.

### Chosen Skips

A Creator does not need to turn every internal event into content.

When the planner selects `skip`:

- the slot is consumed;
- the decision is stored with its reason and source context;
- no post is created;
- no image is generated;
- no model retry is scheduled;
- no image or content charge is made;
- no failed-generation notification is emitted;
- later planning can know that the Creator had a quiet period.

The planner can choose between a low-information casual post and a chosen skip when
there is no strong opportunity. The Creator profile controls the balance.

### Post Campaigns

A set campaign is an optional durable sequence.

The default campaign stages are:

1. Public teaser or cropped preview.
2. Locked multi-image set.
3. Later callback or alternate image.

Each stage can publish, delay, skip, be removed, or be replaced. Stages do not
publish automatically merely because the campaign exists.

Campaigns link:

- the originating request or Creator decision;
- the shoot session;
- planned and published posts;
- teaser and paid access relationships;
- callbacks;
- delayed promises and follow-ups.

This creates a real conversion and retention flow without requiring every post to
be a sales pitch.

### Shoot Sessions

Shoot sessions become complete production records.

Each session stores, at minimum:

- Creator account ID;
- source Character or Persona ID;
- location description;
- outfit description;
- lighting description;
- camera setup;
- camera source;
- theme;
- effort level;
- shots taken;
- shots selected;
- shots used;
- created-at and captured-at timestamps;
- available media asset IDs;
- linked campaign ID;
- session status;
- retention and expiry data.

A post can contain one or many assets from a session. A callback can reuse a real
asset or create a new image from the session context. It must not invent a new room,
outfit, or camera setup when it claims to continue the shoot.

### Existing Slurp Media

`existing_media` and `cropped_preview` use actual Slurp media.

The first source is existing Slurp post media and shoot assets. The system does not
pretend that a newly generated image is an archive image.

Media selection must respect:

- Creator ownership;
- source shoot and campaign;
- access level;
- asset availability;
- deletion and retention status;
- whether a crop or preview is permitted;
- whether the asset was already used in the same campaign stage.

If no valid asset exists, the planner changes the delivery decision or records a
chosen skip. It does not silently create a fake archive reference.

### Creator Strategy Profile

Each Creator receives an automatic strategy profile. The profile is stable until
the user changes it.

The profile contains typed, bounded controls and optional natural-language guidance:

- intent weights;
- delivery weights;
- public versus locked preference;
- documentary versus produced balance;
- camera preferences;
- effort distribution;
- text-only rate;
- Story rate;
- existing-media reuse rate;
- campaign frequency;
- production transparency;
- boundary visibility;
- request handling preference;
- absence and delay preference;
- authored strategy text.

The profile is not the source Character card. It describes how this person uses
Slurp. It must not overwrite voice, identity, appearance, or personality.

Automatic derivation can provide initial values. The user can edit the values from
the Creator profile. A natural-language strategy is supplementary. Typed values
remain the bounded source for planner decisions.

### Manual Intent Controls

The user can choose a one-shot intent and delivery method in the post composer.

The user can also edit the persistent Creator strategy profile.

Manual direction outranks automatic variation for that post. It does not modify the
long-term profile unless the user explicitly saves it there.

The composer must show the consequences of the selected choice:

- access level;
- whether the post uses a new image or existing media;
- whether a campaign or shoot is linked;
- whether the post is public or locked;
- whether an image is required;
- whether the choice can create a charge or paid delivery.

### Shared Creator Continuity

Slurp creates a Slurp-owned shared continuity module. This is groundwork for future
Noodle, chat, roleplay, and game adapters. Those surfaces do not write to the ledger
in this PR.

The source identity is the primary owner of canon:

- one source Character or Persona maps to at most one Slurp Creator account;
- the Slurp Creator account keeps the public Slurp projection and strategy;
- the source identity and Slurp account IDs are both stored on continuity records;
- the mapping is validated and unique;
- no second Slurp account may silently create a second canon for the same source.

The continuity system has four layers:

1. **Canon facts.** Durable Creator facts, boundaries, interests, relationships,
   plans, and stable changes.
2. **Events.** Things that happened, such as a post, request, promise, payment,
   shoot, campaign stage, chosen skip, or meaningful Creator disclosure.
3. **Surface context.** The small approved subset supplied to a post, message, chat,
   roleplay, or game later.
4. **Permissions.** What each surface may read, propose, promote, or write.

The continuity module must not become a second character card. Character identity
remains in the Engine source record. Continuity stores changes and facts that need
to persist across Slurp operations.

### Reality Scope

One event store supports future surface integrations without treating every scene as
literal public history.

Each event declares a reality scope:

- `canon`;
- `slurp`;
- `conversation`;
- `roleplay`;
- `game`;
- `campaign`.

The store is shared, but events have explicit scope. A roleplay or game event cannot
change canon merely because it exists. Future adapters can promote or branch an
event through an explicit action.

This is a shared timeline with reality scope, not a literal history where every
fictional scene changes the public Creator.

### Event Metadata

Every continuity event stores:

- stable ID;
- source identity ID;
- Slurp account ID when relevant;
- event type;
- source surface;
- reality scope;
- audience scope;
- confidence;
- status;
- evidence text or source reference;
- source hash or extraction fingerprint;
- created-at and occurred-at timestamps;
- expiry or retention information;
- related event IDs;
- related message, post, shoot, campaign, request, or promise IDs;
- manual versus generated contribution data;
- conflict and retraction state.

Audience scope uses explicit values such as:

- `thread_private`;
- `fan_private`;
- `creator_private`;
- `creator_public`;
- `cross_platform`;
- `canon_only`.

Source labels identify where an event came from, for example:

- Slurp message;
- Slurp post;
- shoot session;
- campaign;
- payment;
- commission;
- Creator profile;
- future Noodle adapter;
- future chat adapter;
- future roleplay adapter;
- future game adapter.

Status supports at least:

- `proposed`;
- `confirmed`;
- `active`;
- `expired`;
- `disputed`;
- `retracted`;
- `rejected`.

### Memory and Event Extraction

The system retains every message in its existing Slurp thread history. It does not
copy every message into shared canon.

Extraction is hybrid:

- deterministic business events are created directly from successful system
  operations;
- explicit Creator statements, promises, boundaries, and plans may create structured
  candidates from response metadata or a bounded extractor;
- free-text requests, Creator facts, and aggregate demand are scanned in bounded
  batches with checkpoints;
- candidate IDs are selected from a server-created allowlist;
- candidates are normalized and validated before storage;
- source hashes prevent stale extraction from overwriting newer messages;
- duplicate cumulative events are ignored;
- relationship changes require a causal event;
- low-confidence or conflicting changes remain proposed or are rejected.

The implementation should reuse the patterns from Long-Term Memory:

- typed evidence units;
- source provenance;
- confidence and salience;
- source hashes;
- bounded candidate counts;
- draft freshness checks;
- optimistic revisions;
- manual and generated contribution separation;
- retraction and lineage;
- backup, restore, deletion, and retention;
- reference-data framing when context reaches a prompt.

The implementation should not copy the Roleplay-only scope restrictions from Memory
Nag. Slurp needs Creator, content, campaign, relationship, and audience scopes.

### Low-Risk Auto-Apply

Low-risk events can auto-apply:

- successful published posts;
- shoot creation and asset use;
- campaign stage completion;
- payments, unlocks, commissions, delivery state, and refunds;
- explicit Creator statements with strong evidence;
- aggregate demand counts;
- high-confidence stable Creator facts.

Personal disclosures and individual fan preferences do not auto-promote to public
context. They require explicit promotion.

The same event may influence private Creator planning without becoming public. For
example, a private message can create a Creator-private content idea. It cannot
appear in a public post until the user or planner promotes it to the correct
audience scope.

### Slurp Messages

Slurp messages remain a full product surface, not an afterthought.

#### Thread state remains private

The existing viewer-Creator thread state remains separate from Creator canon. It
contains relationship state, familiarity, trust, comfort, posture, resentment,
thread notes, and fan-specific facts.

The event bridge publishes selected structured outcomes. It does not merge the
entire thread state into Creator canon.

#### Message prompts read

A Slurp message reply reads, in order of relevance:

- current thread state;
- recent messages;
- thread notes and active promises;
- approved Creator canon;
- recent Slurp posts, shoots, campaigns, and business activity relevant to the
  viewer;
- approved promoted context from other surfaces when future adapters exist.

Locked content remains protected. A message prompt can know that a paid post exists
without receiving locked content that the viewer cannot access.

#### Message events

The bridge handles:

- Creator plans and promises;
- Creator boundaries and availability;
- content requests;
- repeated demand trends;
- commissions and paid requests;
- tips, unlocks, refunds, and delivery;
- delays and follow-up commitments;
- Creator disclosures;
- apologies, conflicts, and relationship outcomes;
- subscriber return or churn signals.

Fan-specific details remain in the thread unless explicitly promoted. Aggregate
demand may affect Creator-wide planning without identifying the fan.

#### Request actions

Every request can be handled from the message thread:

- fulfill;
- tease;
- decline;
- delay;
- ignore;
- aggregate.

Actions create planner opportunities or continuity events with the correct scope.
Fulfill and tease can create campaign stages. Decline creates a boundary event.
Delay creates a promise and follow-up. Ignore stores the request privately without
creating a content action. Aggregate updates a Creator-wide demand trend without
revealing the requesting fan.

#### Follow-ups

Message promises and follow-ups connect to the Content Planner.

A promise may create:

- a future content opportunity;
- a campaign stage;
- a planned delivery;
- a callback;
- a message follow-up;
- a delay or absence update.

The system must not promise content and then silently lose the promise when the
Creator posts later.

### Profile Continuity Editor

The Creator profile gains a continuity editor. Backstage has an operational view of
the same records. The post composer and Slurp message thread can open focused actions
against the same data.

The editor supports:

- browse facts and events;
- search and filter by type, source, scope, status, confidence, and date;
- approve and reject proposals;
- edit facts and event text;
- retract stale or incorrect contributions;
- promote private context to an explicit audience scope;
- link requests, messages, posts, shoots, campaigns, promises, and outcomes;
- inspect source evidence and extraction fingerprints;
- resolve conflicts;
- view pending content opportunities and chosen skips.

The profile is the main human control surface. Backstage provides cross-Creator
operations. The message thread handles request-specific actions. The post composer
handles one-shot intent and delivery decisions.

### Public Promotion

All promotion paths are explicit and auditable.

Possible promotion sources:

- a Creator says the fact in a public post;
- a Creator states public intent in a Slurp message;
- the user promotes a private event in the continuity editor;
- the planner selects a private request for a teaser, post, or campaign;
- the user approves a proposed promotion in the relevant surface.

Promotion creates a new derived event or contribution. It does not mutate the
private source event into a public event. This preserves privacy and makes retraction
possible.

## Proposed Data Model

The exact table names follow existing Slurp2 file-table conventions. The names below
are conceptual and must be reconciled with the schema before implementation.

### Source Mapping

`slurp2_creator_canon_map`

- `id`;
- `sourceKind`;
- `sourceEntityId`;
- `slurpCreatorAccountId`;
- `createdAt`;
- `updatedAt`;
- unique source identity;
- unique Slurp Creator account.

### Canon Facts

`slurp2_continuity_facts`

- `id`;
- source identity and Slurp account IDs;
- fact type;
- subject and optional related subject;
- text or structured payload;
- audience scope;
- reality scope;
- confidence and salience;
- status;
- evidence and source hash;
- manual/generated contribution metadata;
- timestamps and expiry;
- conflict and retraction fields.

### Timeline Events

`slurp2_continuity_events`

- `id`;
- event type;
- source label;
- reality scope;
- audience scope;
- structured payload;
- status;
- confidence;
- source references;
- related record IDs;
- occurred-at and created-at;
- extraction fingerprint;
- expiry and retraction fields.

### Proposals and Revisions

`slurp2_continuity_proposals`

- `id`;
- source event or fact candidate;
- proposed mutation;
- risk;
- confidence;
- source hash;
- extraction context;
- status;
- reviewer;
- revision;
- created-at and reviewed-at.

### Content Opportunities

`slurp2_content_opportunities`

- `id`;
- Creator account ID;
- source identity ID;
- intent;
- delivery;
- workflow state;
- access;
- source event IDs;
- request or promise IDs;
- shoot and campaign IDs;
- chosen skip reason when applicable;
- deterministic planner seed;
- planned-at, due-at, published-at;
- generation result and failure state;
- user override metadata.

### Campaigns and Stages

`slurp2_content_campaigns`

- `id`;
- Creator account ID;
- source request or event;
- theme and content notes;
- campaign status;
- created-at and expiry.

`slurp2_content_campaign_stages`

- `id`;
- campaign ID;
- stage kind;
- order;
- intent;
- delivery;
- access;
- linked opportunity;
- linked post;
- linked shoot or asset IDs;
- status;
- due-at and completed-at.

### Shoot Sessions and Assets

Extend the current shoot session record with production details and asset links.

Add or formalize:

- location;
- outfit;
- lighting;
- camera setup;
- camera source;
- theme;
- effort;
- shots taken;
- shots selected;
- shots used;
- asset IDs;
- campaign ID;
- captured-at;
- expiry and status.

### Demand Trends

`slurp2_creator_demand_trends`

- Creator account ID;
- normalized topic or request class;
- count;
- first seen and last seen;
- source request IDs;
- audience scope;
- status;
- expiry.

No fan identity or exact private request text is required for an aggregate trend.

## Generation Flow

### Automatic Slot

1. Scheduler asks the Content Planner for the next slot.
2. Planner loads Creator strategy, current state, active opportunities, campaigns,
   shoots, requests, promises, demand trends, and approved continuity context.
3. Planner checks whether the slot should publish or be a chosen skip.
4. Planner selects intent, delivery, access, and workflow.
5. Planner stores the opportunity before model generation.
6. If the opportunity uses existing media, the planner selects valid assets.
7. If the opportunity uses a campaign or shoot, the planner reserves those records.
8. The post model receives the Creator voice, approved context, and the selected
   posting job.
9. The image path receives the delivery and production metadata, not a caption
   scene rewrite.
10. Media is generated or attached according to the stored delivery decision.
11. The post, opportunity, shoot, campaign stage, and continuity events commit as
    one durable outcome where possible.
12. A successful post writes deterministic system events.
13. A failure releases reservations or records a real failed state without turning
    a chosen skip into a failure.

### Manual Post

1. User opens the post composer.
2. User can choose one-shot intent, delivery, access, campaign, shoot, and approved
   continuity context.
3. The composer validates combinations before generation.
4. The planner stores the opportunity.
5. Generation and media attachment follow the same execution path as automatic
   posts.

### Message Request

1. A request remains in the private thread.
2. The user or Creator response selects fulfill, tease, decline, delay, ignore, or
   aggregate.
3. The action creates the relevant opportunity, campaign stage, promise, boundary,
   or demand trend.
4. The thread receives an immediate response or scheduled follow-up.
5. The planner later executes the content opportunity if one was created.

## Prompt Design

The new prompt system must preserve the current voice improvements while adding the
planner context.

Post prompts receive:

- source Character or Persona context;
- Slurp public identity;
- Creator strategy profile;
- current Creator state;
- selected intent;
- selected delivery;
- access and campaign context;
- approved continuity facts and events;
- recent Slurp posts;
- request or demand context without private fan leakage;
- shoot and media context;
- timing and schedule;
- user guidance;
- output contract.

The prompt must not receive:

- unrelated private fan details;
- locked content the viewer cannot access;
- raw continuity instructions as executable commands;
- unresolved proposals;
- roleplay or game events outside the selected scope.

Messages receive:

- current private thread state;
- thread notes and promises;
- approved Creator canon;
- relevant recent Slurp activity;
- allowed request and business context;
- explicit boundaries;
- output contract for the message type.

The system frames continuity as reference data. Stored text cannot override prompt
rules or permissions.

## Migration

### Settings

- Read existing `promptMode` and prompt-block overrides.
- Move compatible overrides into the Produce block keys.
- Save old prompt definitions and compatible edits as the Classic prompt preset.
- Set the runtime generation path to Produce.
- Remove Classic from the runtime mode enum and generation branches.
- Keep preset selection as a prompt-text operation only.
- Preserve unrelated settings and Creator overrides.

### Existing Posts

Existing posts remain unchanged.

New metadata is optional for old rows. The first new operation that touches an old
post may create a continuity projection without rewriting published text or media.

### Existing Shoots

Current shoot rows receive safe defaults for fields that did not exist. Unknown
historical production details remain absent rather than being invented.

### Existing Messages

Existing messages remain in their current threads. The first bounded extraction scan
uses a checkpoint and source hash. No old message becomes public Creator canon
without a valid scope and promotion path.

### Existing Classic Edits

The migration must have a regression test that proves:

- matching edits survive in Produce blocks;
- incompatible blocks use Produce defaults;
- the Classic prompt preset contains the old prompt text;
- selecting the preset does not enable Classic runtime generation;
- a second migration is idempotent;
- no user prompt edits are silently deleted.

## UI Surfaces

### Creator Profile

Add:

- strategy profile editor;
- one-shot next-intent selector;
- delivery and access preferences;
- shoot and campaign summary;
- continuity editor;
- pending memory proposal list;
- private-to-public promotion actions;
- request and promise summary;
- chosen-skip history.

### Slurp Message Thread

Add contextual actions for:

- fulfill;
- tease;
- decline;
- delay;
- ignore;
- aggregate;
- approve or reject a proposed Creator-context event;
- open the linked content opportunity or campaign.

The thread must clearly distinguish fan-private facts from Creator-wide promoted
context.

### Backstage

Add a continuity panel that supports cross-Creator operations:

- search and filter facts and events;
- inspect proposals and risks;
- approve, reject, edit, retract, and promote;
- inspect campaigns, shoots, opportunities, and skips;
- view extraction checkpoints and stale-source warnings;
- view current Creator strategy and overrides.

### Post Composer

Add one-shot selectors for:

- intent;
- delivery;
- access;
- campaign;
- shoot or existing media;
- approved continuity context.

The composer must explain incompatible combinations before generation.

## Architecture

Keep the existing Slurp2 package boundaries.

### Shared Slurp root

Place pure contracts and schemas in the existing shared Slurp root:

- continuity event types;
- fact and proposal types;
- audience and reality scopes;
- intent, delivery, and workflow types;
- validation helpers that need no storage or model call.

### Server modules

Place pure planner and continuity rules in `server/src/slp/modules/`:

- content intent rules;
- delivery compatibility rules;
- workflow transitions;
- strategy defaults and normalization;
- continuity validation;
- evidence normalization;
- promotion rules;
- risk classification;
- request action rules.

### Server data

Place persistence in `server/src/slp/data/`:

- continuity storage;
- proposal and review storage;
- planner storage;
- campaign storage;
- expanded shoot and media storage;
- demand trend storage.

### Server features

Keep route and orchestration code in existing features:

- `features/feed/` for planner and post execution;
- `features/messages/` for request actions and message event bridge;
- `features/creators/` for profile strategy and continuity editor contracts;
- `features/projects/` for campaign integration where appropriate;
- `features/media/` for existing-media selection and multi-image attachment;
- `features/settings/` for global planner defaults and preset migration;
- `features/viewer/` for route plumbing.

Use feature contracts for cross-feature calls. Do not import feature internals.

### Client

Keep profile, message, Backstage, composer, and settings UI in their owning Slurp
features. Reuse the existing contract and hook patterns.

### No Engine shared change in this PR

The continuity ledger is Slurp-owned. Do not change the Engine shared package. Do
not make chat, roleplay, game, or Noodle read or write it. Do not add adapter
contracts before a second writer exists.

## Sliced Commit Order

Each slice must build, add focused regression proof, and preserve the dirty-worktree
rule. The slices form one PR.

1. **Remove Classic runtime mode and add preset migration.**
   - Prompt mode becomes Produce-only at runtime.
   - Add Classic prompt preset storage and selection.
   - Migrate old matching edits.
   - Add migration proof.

2. **Define intent, delivery, and workflow contracts.**
   - Add typed axes.
   - Add compatibility rules.
   - Add explicit text-only, Story, existing-media, multi-image, cropped-preview,
     absence, delay, and chosen-skip behavior.

3. **Add the durable Content Planner.**
   - Create opportunities before generation.
   - Store deterministic decisions.
   - Add chosen skips.
   - Route automatic and manual posts through the same planner.

4. **Add Creator strategy profiles and controls.**
   - Persist typed controls and authored strategy text.
   - Add automatic defaults.
   - Add Creator profile editing.
   - Add one-shot intent controls.

5. **Expand shoot sessions and existing-media delivery.**
   - Add production metadata and asset links.
   - Implement real existing-media selection.
   - Add multi-image posts.
   - Add Story and cropped-preview delivery.
   - Add retention and deletion checks.

6. **Add campaigns and the teaser-to-set-to-callback funnel.**
   - Add campaign and stage storage.
   - Link opportunities, shoots, posts, access, and callbacks.
   - Allow optional publish, delay, skip, remove, and replacement per stage.

7. **Build the shared continuity ledger.**
   - Add source identity mapping.
   - Add facts, events, scopes, status, confidence, evidence, hashes, and revisions.
   - Register backup, restore, deletion, and retention.

8. **Add evidence extraction and safe auto-apply.**
   - Add deterministic system-event writes.
   - Add bounded message extraction with checkpoints.
   - Add candidate normalization and validation.
   - Add confidence, risk, stale-source, and conflict checks.
   - Auto-apply approved low-risk categories.

9. **Bridge Slurp messages to the planner and ledger.**
   - Add request actions.
   - Connect promises and follow-ups.
   - Store aggregate demand.
   - Keep fan-specific state private.
   - Add explicit promotion paths.

10. **Add the Creator continuity editor.**
    - Browse, search, filter, approve, reject, edit, retract, promote, and link.
    - Add Creator profile, message-thread, Backstage, and composer entry points.

11. **Update post, image, and message prompts.**
    - Use planner decisions and approved continuity context.
    - Use request and campaign context without private leakage.
    - Preserve voice and identity from the source Character or Persona.
    - Remove stale Classic runtime branches and prompt assumptions.

12. **End-to-end integration and release rebuild.**
    - Run migration and backup proof.
    - Run automatic, manual, message, campaign, shoot, media, and continuity flows.
    - Rebuild Slurp2 and catalog outputs.
    - Update changelog and package version once for the PR.

## Validation Plan

### Pure regression proof

Add focused tests for:

- intent, delivery, and workflow compatibility;
- deterministic planner decisions;
- chosen skips with no side effects;
- one-shot manual overrides;
- strategy profile normalization and bounds;
- Classic preset migration and idempotence;
- source identity uniqueness;
- event scope and audience-scope validation;
- candidate allowlists and invalid model output;
- source hashes and stale proposals;
- confidence and risk classification;
- low-risk auto-apply boundaries;
- promotion creates derived events rather than mutating private events;
- fan-private data does not enter Creator-public context;
- aggregate demand removes fan identity;
- request action transitions;
- promise to planner connections;
- campaign stage transitions;
- shoot asset compatibility;
- multi-image post storage;
- existing-media deletion and access rules;
- chosen skip persistence and retry behavior.

### Source and architecture proof

Run:

```text
tsx --tsconfig tests/tsconfig.regressions.json tests/slurp2-architecture.regression.ts
node scripts/typecheck-packages.mjs slurp2
```

Update source mappings and architecture tests when files move. Register every new
table in backup and restore tests.

### Repository gates

Run:

```text
npm run check
node scripts/test-catalog-lanes.mjs
node scripts/validate-package-locales.mjs
node scripts/validate-catalog.mjs
node scripts/tests/catalog-release-notes.regression.mjs
```

### Full regression comparison

Compare the complete Slurp regression suite against a clean `staging` worktree.
Report baseline failures separately from new failures.

### Live behavior proof

Use a dev Engine with temporary test data. Do not use production.

Verify:

- one source Character creates one Slurp Creator account;
- Produce generation creates an opportunity before model work;
- a chosen skip creates no post, image, charge, or retry;
- text-only delivery stays text-only when image generation is available;
- existing media attaches the selected real asset;
- a multi-image post stores and renders all assets;
- Story and cropped-preview delivery work;
- teaser, locked set, and callback campaign stages link correctly;
- a shoot preserves physical production details;
- request actions create the right opportunity or private outcome;
- promises schedule and later resolve;
- fan-private facts stay private;
- aggregate demand affects planning without fan identity;
- the continuity editor can approve, reject, edit, retract, promote, and link;
- Creator voice remains consistent with the source card;
- message replies see approved canon and current thread state;
- Classic prompt preset restores old prompt text without restoring Classic runtime
  generation;
- backup and restore preserve facts, events, proposals, opportunities, campaigns,
  shoots, assets, and request links.

Test populated, empty, loading, disabled, failed-provider, stale-proposal, deleted-
media, and permission-denied states.

Test desktop and mobile layouts in light and dark themes. Capture screenshots for
profile continuity, Backstage, message request actions, and composer controls.

## Security and Privacy Requirements

- Treat all model output and imported text as data, not instructions.
- Validate every model-selected ID against server-created allowlists.
- Do not put locked content into prompts for viewers without access.
- Do not expose fan identity in aggregate demand.
- Do not promote private message data without an explicit promotion action.
- Keep private source events separate from derived public events.
- Require source hashes and revisions for extracted candidates.
- Block stale proposals from overwriting current facts.
- Require explicit action for retractions and destructive edits.
- Preserve identity disclosure protection for Creator prompts and previews.
- Register all new tables, media assets, and event data in backup and deletion flows.
- Apply retention to raw extraction artifacts, proposals, expired events, and unused
  media.
- Ensure one source identity cannot create multiple Slurp Creator projections.

## Out Of Scope For This PR

- Noodle writing to the new continuity ledger.
- Chat, roleplay, or game surfaces writing to the ledger.
- Engine shared-package changes.
- A general experiment assignment or cohort system.
- Automated optimization from engagement metrics.
- Automatic publishing of all campaign stages without user or planner decisions.
- Automatic promotion of private fan details to public context.
- A second Slurp Creator account for one source Character or Persona.
- Typed adapter contracts for Noodle, chat, roleplay, and game surfaces. No surface
  other than Slurp writes to the ledger in this work. The contract is added when the
  second writer exists.

Reality scope is still stored on every fact and event, because it controls privacy
and prompt visibility inside Slurp today.

## Success Criteria

The PR is complete when:

- Slurp has one Produce runtime engine.
- Classic prompt text survives as a selectable Classic prompt preset.
- Automatic and manual posts use the durable Content Planner.
- Intent, delivery, and workflow are separate and persisted.
- A Creator can publish casual, teaser, set, BTS, request, appreciation, callback,
  business, absence, and delay behavior without every post becoming a cinematic
  scene.
- Text-only, existing-media, Story, multi-image, and cropped-preview delivery are
  real choices.
- Chosen skips are durable and side-effect free.
- Campaigns can link teaser, locked set, and callback stages.
- Shoot sessions preserve real production continuity.
- Slurp messages can fulfill, tease, decline, delay, ignore, and aggregate requests.
- Thread state stays private while selected structured events cross the bridge.
- The continuity editor provides full browse, review, edit, retract, promote, and
  link operations.
- Low-risk events auto-apply with evidence and scope controls.
- Fan-private information does not leak into Creator-public prompts.
- The source Character or Persona remains the identity and voice authority.
- Every fact and event carries a reality scope that controls prompt visibility.
- Focused regressions, full baseline comparison, live dev proof, backup proof, and
  package gates pass.
