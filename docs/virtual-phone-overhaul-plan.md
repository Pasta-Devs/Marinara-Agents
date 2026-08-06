# Virtual Phone Overhaul Plan

## Purpose

The next Virtual Phone pass should make the phone feel like a dependable mobile operating system instead of a collection of generated pages. It must remain useful while data is loading, during partial failures, and when the model produces incomplete content.

The pass has four connected goals:

1. Keep a real phone UI visible at all times.
2. Make navigation behave like a real app, with app-level back controls in the top menu bar.
3. Make the home screen, App Store, and Settings feel like coherent first-party phone surfaces.
4. Make app content cheap and predictable to generate, so smaller models can fill pages successfully using structured context from the chat, gallery, and other agents.

This is intentionally a multi-commit change. Each commit should leave the package buildable and should have a narrow behavioral claim that can be tested independently.

## Test Server Catalog Contract

The Marinara Engine test server already uses this catalog URL:

```text
https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/virtual-phone-test-catalog/test-catalog.json
```

All implementation and validation work in this pass must continue to use that existing test-server catalog contract. Do not introduce a new catalog URL, branch, endpoint, mirror, documentation URL, or environment-specific override for Virtual Phone. The package must remain discoverable and installable through the existing `virtual-phone-test-catalog` branch and its `test-catalog.json` entry.

When generated package outputs change, update the source and generated release data required by the repository workflow, but preserve the test server's catalog URL and branch. Validation must check the generated Virtual Phone entry and artifact are reachable through the existing catalog contract; a local or alternate catalog is not a substitute for that check.

## Current Problems

The primary client implementation is [`packages/virtual-phone/src/engine/packages/client/src/features/virtual-phone/PhoneShell.tsx`](../packages/virtual-phone/src/engine/packages/client/src/features/virtual-phone/PhoneShell.tsx).

- The home screen can briefly look empty while the app catalog is loading.
- A loading app page replaces the entire viewport with one text line.
- A failed page has no retry action and loses the useful app frame.
- Back currently lives in the global phone status bar rather than the active app menu bar.
- Home shortcuts use competing bottom-aligned blocks, creating dead space and weak hierarchy.
- Settings only changes wallpaper.
- Generated pages depend on model-filled HTML slots. The fixed templates help, but the content contract still asks the model to produce too much markup and does not yet use a deliberate context projection from the rest of the Engine.
- The package has access to chat context and package runtime services, but gallery and other agent data need an explicit, bounded source contract before they can safely influence generated pages.
- `client.js`, `server.mjs`, archives, hashes, and catalog entries are generated outputs. Source changes must be rebuilt rather than hand-edited.

## Design Principles

### Never render an empty surface

Every screen has a stable skeleton or fallback layout before asynchronous work completes. A failed request preserves the surrounding app chrome and exposes a clear retry action. The phone should still show its home screen, Store, Settings, and navigation even when the catalog or model endpoint is unavailable.

### Separate shell navigation from generated app content

The host shell owns phone-level navigation, app title, back behavior, loading state, retry state, and refresh controls. The sandboxed iframe owns simulated app links and forms. This provides consistent navigation even when generated app HTML is incomplete.

### Prefer structured content over generated chrome

The model fills typed content data or narrowly documented slots. It should not need to design an app, recreate headers, invent navigation, or emit large amounts of markup. The renderer owns layout, escaping, labels, empty states, and safety limits.

### Context is explicit, bounded, and chat-scoped

Pages may use relevant information from the current chat, persona, characters, gallery, and compatible agent-owned sources. Context is selected for the requested app and route, capped by size, labeled by provenance, and never shared across chats or phone owners.

### Small models get an easy path

The default generation request should be a compact JSON object with a small number of fields, short per-field instructions, and deterministic fallback values. A model that returns partial JSON should still produce a complete page. The system should not require a model to understand the full phone UI or write arbitrary HTML.

## Scope

### Included

- Phone shell state model and persistent fallback UI.
- Loading skeletons with a restrained swooshing shimmer effect.
- Retry actions for catalog and page failures.
- App-level top menu bars with back controls.
- Home screen redesign.
- Settings redesign.
- App Store redesign.
- Structured, small-model-friendly content generation contracts.
- Chat, gallery, persona, character, and other-agent context projection.
- Provenance, size limits, privacy boundaries, and source failure tolerance.
- Focused regression coverage and generated package rebuilds.
- Verification against the existing `virtual-phone-test-catalog` test-server catalog URL.

### Not included without a separate decision

- Executing arbitrary generated JavaScript in app pages.
- Direct access from phone pages to Engine storage or other agent internals.
- Unbounded full-chat or full-gallery injection into prompts.
- A new general-purpose cross-agent database.
- Replacing the existing sandbox model or changing package permissions broadly.
- A full visual rewrite of every generated app template before the shell and content contracts are stable.

## Architecture Plan

### 1. Persistent runtime states

Replace independent booleans with explicit catalog and page state, for example:

- `catalog: loading | ready | error`
- `page: idle | loading | ready | error`
- `lastRequest` containing the app, URL, action, form data, and refresh intent needed for retry.
- `current` retaining the last successful history entry while a new request is in flight.

Navigation requests must be guarded against stale responses. A cancelled or older request must not replace a newer page. Refreshing a page should keep the existing page visible beneath a loading treatment where practical.

### 2. Host-owned app toolbar

For Store, Settings, and generated apps, add a consistent top app bar below the phone status bar. It should contain:

- app icon and title on the left;
- back icon button on the right;
- refresh or retry action where the current state supports it;
- accessible labels and `title` tooltips for unfamiliar icon buttons.

Back behavior:

- If an app history entry exists, return to the previous cached entry without a model call.
- If the current entry is the first app entry, return to the phone home screen.
- Store and Settings return to home.

The global phone status bar should retain time, privacy/observer state, and phone-level status only.

### 3. Shared loading and error surfaces

Create one shared visual language for asynchronous states:

- skeleton app bar;
- summary skeleton;
- 3-5 list rows/cards;
- bottom navigation placeholder for generated app pages;
- compact catalog/store rows;
- retry action with a useful failure message.

The shimmer must be implemented with CSS, be disabled for `prefers-reduced-motion: reduce`, and never cause layout shifts. Loading states should use `aria-busy`; failures should use `role="alert"`.

### 4. Home screen

Use a stable launcher composition:

- clock/date or owner context area;
- fixed-size app grid with predictable icon and label dimensions;
- built-in Settings and App Store shortcuts that render even before catalog success;
- bottom dock for the primary system shortcuts;
- compact catalog loading/error status that does not displace the launcher.

When installed apps are unavailable, show reserved app slots or fallback preinstalled shortcuts instead of a blank area. A zero-app state must still provide App Store access and catalog retry.

### 5. Settings

Turn Settings into a first-party app with an app toolbar and sections for:

- Appearance and wallpaper previews;
- Installed apps and count;
- App Store shortcut;
- observer/privacy behavior;
- phone ownership and storage scope information;
- About/version information where available.

Any reset or destructive storage action requires an explicit confirmation. Settings remain scoped to the current `phoneStorageIdentity`.

### 6. App Store

The Store needs its own toolbar, category sections, stable app rows, install state, loading skeletons, retry state, and a useful empty catalog state. Install/remove actions must not disappear or change dimensions while requests resolve.

## Content Generation Plan

### 1. Render model, not HTML

Keep the fixed route templates, but move the normal generation contract toward typed page data. A route should declare a compact schema such as:

```ts
type PhonePageContent = {
  title?: string;
  summary?: string;
  items?: Array<{
    id?: string;
    title: string;
    detail?: string;
    meta?: string;
    icon?: string;
    href?: string;
  }>;
  detail?: Array<{ label: string; value: string }>;
  action?: { label: string; href?: string };
};
```

Special apps such as Noodle and Noodler can retain specialized schemas for posts, profiles, subscriptions, and messages, but each should use short typed fields rather than asking the model to author full markup. The renderer converts those fields to escaped HTML.

The schema must be route-specific and small. Do not ask a small model to fill irrelevant fields or produce a complete page when only a summary and five rows are needed.

### 2. Route-level generation contracts

Each template should declare:

- required fields;
- optional fields;
- maximum item count;
- maximum string lengths;
- allowed link destinations;
- source types that are relevant to the route;
- fallback content for every missing field.

The prompt should include the route contract and a short example of valid JSON. It should explicitly say to return JSON only, omit unknown fields, and keep values concise. Parsing should tolerate fenced JSON and partial objects, then normalize and validate the result before rendering.

### 3. Small-model strategy

Use a staged generation path:

1. Build a compact context packet and route contract.
2. Ask for one bounded JSON response.
3. Parse, normalize, validate, truncate, and repair missing fields locally.
4. Render immediately using deterministic fallback values.
5. Only use a second model pass when a route genuinely needs it, such as a long detail view or a special social feed.

The first pass should be able to succeed with a low token budget. Avoid sending the entire template HTML, full conversation transcript, large gallery payloads, or unrelated agent state. The prompt builder should report the selected context sources and estimated size for debugging without exposing secrets.

### 4. Context projection from the chat

Create a server-side context projection layer for Virtual Phone pages. It should accept the existing page request context and produce only relevant, bounded facts:

- recent chat messages, summarized or clipped to the route need;
- chat name, mode, persona, and character identities;
- stable facts already established in the scene;
- recent actions taken in the phone;
- current app/page URL and navigation history.

The projection should distinguish user-controlled facts from character-authored facts. The model must not invent outgoing messages or posts as the user's persona when the app contract forbids that.

### 5. Gallery and media context

Add a narrow gallery adapter rather than allowing direct phone access to gallery storage. The adapter should expose only metadata needed to render a page:

- stable image/media id;
- caption or description;
- date/time if available;
- album or collection;
- people/tags only when already permitted by the host;
- a host-resolved display reference if the renderer can safely use one.

Gallery data should be selected by relevance to the current chat/persona/route and capped by count and field length. Missing gallery access must degrade to generated descriptions or an empty-but-structured media state.

### 6. Other agent context

Define an allowlisted adapter interface for compatible agent packages to contribute read-only display facts, for example:

```ts
type PhoneContextSource = {
  id: string;
  label: string;
  list(input: {
    chatId: string;
    owner: PhoneOwner;
    appId: string;
    route: string;
    limit: number;
  }): Promise<PhoneContextRecord[]>;
};
```

Adapters must be registered by the host or package contract. The Virtual Phone must not discover arbitrary modules or read another agent's private storage by path. Each record needs provenance, a stable id, a short display label, and a sensitivity classification.

Initial candidates should be limited to sources that already have stable public/runtime APIs, such as gallery/media metadata, character/persona resources, and selected feature summaries. Add one source at a time and prove its failure behavior.

### 7. Provenance, privacy, and isolation

Every context record passed to generation should carry a source label internally, even if the label is not displayed. Enforce:

- current chat id and phone owner scope;
- no cross-chat cache reuse;
- no raw credentials, provider configuration, or private implementation details;
- explicit limits on records, bytes, and individual strings;
- source errors are logged and omitted, not fatal to page rendering;
- sensitive sources are opt-in or excluded from routes that do not need them.

### 8. Deterministic fallback content

Every route must render a useful result when the model returns no usable content. Examples:

- Search: “Search is ready” plus recent/relevant known entities when available.
- Maps: current scene location or “No location has been established yet.”
- Gallery: available albums or “No photos have been shared with this phone.”
- Messages: known conversation participants with neutral previews.
- Notes/calendar/wallet: structured empty states with an action or explanation.

Fallbacks should be renderer-owned, concise, and clearly distinguish unavailable data from an empty real-world result.

## Multi-Commit Sequence

Each commit should be buildable. Do not combine generated output from unrelated source commits. Rebuild the package after source changes that affect payloads, then include the generated files in the same commit as their source inputs.

### Commit 1: `refactor(virtual-phone): make shell states persistent`

Claim: catalog and page requests cannot blank the phone, and stale requests cannot overwrite newer navigation.

Changes:

- explicit catalog/page state model;
- current page retained during loading;
- request identity and retry request storage;
- built-in home/system fallback data;
- no visual redesign beyond state plumbing.

Validation:

- focused source/client checks for initial, loading, stale response, and error states;
- Virtual Phone regression test;
- package rebuild and generated-output review.

### Commit 2: `feat(virtual-phone): add app toolbars and retry surfaces`

Claim: every Store, Settings, and app page has consistent host-owned back navigation and retry behavior.

Changes:

- move app back from status bar into app menu bars;
- add app title/icon toolbar;
- add retry and refresh actions;
- preserve current page behind loading/error states;
- accessibility labels, focus-visible treatment, and `aria-busy`/`role="alert"`.

Validation:

- back behavior for first page and nested history;
- retry repeats the exact failed request;
- Store/Settings return to home;
- package rebuild and catalog validation.

### Commit 3: `feat(virtual-phone): add resilient loading skeletons`

Claim: asynchronous phone states always show recognizable app structure with motion that respects user preferences.

Changes:

- shared skeleton components/styles;
- shimmer/swoosh animation;
- reduced-motion behavior;
- catalog, Store, and app viewport loading states;
- stable dimensions to prevent layout shifts.

Validation:

- loading screenshots or browser checks at phone-sized desktop and mobile viewports;
- reduced-motion check;
- no empty viewport during delayed catalog/page requests.

### Commit 4: `feat(virtual-phone): overhaul launcher and system apps`

Claim: the phone home screen, App Store, and Settings are coherent first-party surfaces even with no installed apps or failed catalog access.

Changes:

- home grid/dock redesign;
- stable fallback app slots;
- Store redesign;
- Settings sections and wallpaper controls;
- observer/privacy and install-state presentation.

Validation:

- fresh phone;
- zero installed apps;
- catalog loading and catalog failure;
- persisted background/install state;
- responsive layout and keyboard navigation.

### Commit 5: `refactor(virtual-phone): add compact page content contracts`

Claim: ordinary generated apps can be filled by a small model with bounded JSON instead of arbitrary HTML.

Changes:

- route-specific schemas and limits;
- compact prompt builder with examples;
- tolerant parse/normalize/validate pipeline;
- renderer-owned escaping and deterministic fallbacks;
- retain compatibility for specialized Noodle/Noodler schemas only where needed.

Validation:

- valid JSON;
- fenced JSON;
- partial JSON;
- malformed response;
- oversized fields/items;
- disallowed URLs and HTML injection attempts;
- every framework route renders with empty, partial, and complete content.

### Commit 6: `feat(virtual-phone): project chat context for page generation`

Claim: generated pages use relevant current-chat facts without sending unnecessary transcript data or writing as the user's persona.

Changes:

- server-side context projection;
- route-specific selection and clipping;
- provenance metadata;
- prompt size instrumentation;
- explicit user/persona/character authorship rules.

Validation:

- context appears for relevant routes;
- unrelated messages are excluded;
- user persona boundaries remain intact;
- no cross-chat identity or history leakage;
- source omission does not fail page generation.

### Commit 7: `feat(virtual-phone): add gallery and approved agent sources`

Claim: pages can use bounded gallery and allowlisted agent data without direct storage coupling or cross-feature leakage.

Changes:

- source adapter interface;
- gallery metadata adapter;
- first approved agent adapters;
- limits, sensitivity policy, source provenance, and failure isolation;
- route/source relevance map.

Validation:

- populated gallery;
- empty gallery;
- unavailable gallery source;
- populated and unavailable agent source;
- chat/owner isolation;
- no credentials or private storage paths in prompt packets.

### Commit 8: `test(virtual-phone): add end-to-end content and resilience proof`

Claim: the complete phone works through delayed loads, model failures, partial content, context sources, and persisted navigation state.

Changes:

- expanded regression tests;
- route/content contract fixtures;
- source failure fixtures;
- browser-level checks if the Engine test environment supports them;
- documentation of manual install/update/restart/offline/uninstall verification.

Validation:

- `node scripts/test-catalog-lanes.mjs`
- `node scripts/validate-catalog.mjs`
- `git diff --check`
- Virtual Phone regression test
- manual compatible Engine install and update
- restart with cached state
- offline/error behavior
- uninstall cleanup

## Build and Repository Workflow

Before implementation, link or create the issue and use the repository's normal staging/draft-PR workflow. The plan does not require committing now, but the eventual implementation should follow the repository rules in [`CONTRIBUTING.md`](../CONTRIBUTING.md) and [`AGENTS.md`](../AGENTS.md).

The test-server catalog URL is fixed as described in [Test Server Catalog Contract](#test-server-catalog-contract). Do not create a new URL or change the branch used by the Engine test environment as part of this work.

For source changes:

1. Read the affected manifest, builder definition, source, and tests.
2. Make one focused source commit.
3. Rebuild the narrowest affected feature package with `node scripts/build-feature-packages.mjs virtual-phone` if supported by the current builder, otherwise use the documented focused build invocation.
4. Inspect generated payloads and hashes; never hand-edit them.
5. Run the focused Virtual Phone regression test.
6. Run catalog lanes, catalog validation, and `git diff --check` at the validation gate.
7. Verify the package entry through `https://raw.githubusercontent.com/Pasta-Devs/Marinara-Agents/virtual-phone-test-catalog/test-catalog.json`; do not validate against a replacement catalog URL.

Generated files expected to move when the package payload changes:

- `packages/virtual-phone/client.js`
- `packages/virtual-phone/server.mjs`
- `packages/virtual-phone/manifest.json` hashes and sizes
- `artifacts/virtual-phone-*.zip`
- relevant generated catalog entries

## Acceptance Criteria

### Phone behavior

- Opening the phone always shows a usable frame and launcher, even before the catalog request resolves.
- Opening an app always shows an app toolbar and a recognizable skeleton or cached page while loading.
- A failed catalog or page request leaves the shell visible and exposes a working retry button.
- App back controls are located in the active app's top menu bar.
- Back does not trigger a model call when a cached history entry exists.
- Home, Store, and Settings remain usable with zero installed apps.
- Shimmer animation is disabled or simplified under reduced-motion preferences.

### Content generation

- Ordinary pages can be rendered from bounded structured content with no model-authored page chrome.
- A small or partially successful model response still produces a complete usable page.
- Content contracts specify limits, fallbacks, allowed links, and route-relevant sources.
- Chat, gallery, and approved agent data are selected server-side, scoped to the current chat/owner, and bounded before entering prompts.
- A failed or unavailable context source does not blank or fail the page.
- No raw credentials, provider settings, arbitrary storage access, or cross-chat records enter the page context.

### Delivery

- Each commit in the sequence is independently buildable and reviewable.
- Source, generated payload, artifact, manifest metadata, and catalog remain synchronized.
- The package remains discoverable through the existing `virtual-phone-test-catalog` URL, with no replacement URL introduced.
- Focused tests and repository validation commands pass before the final PR is marked ready.
- Manual verification notes distinguish completed checks from unverified gaps.

## Open Decisions Before Coding

1. Which Engine/public APIs expose gallery metadata and selected other-agent data without private imports?
2. Should ordinary routes move fully to JSON schemas in the first content commit, or should the first version support JSON alongside the existing slot HTML path during migration?
3. Which first-party agents are approved as initial Virtual Phone context sources?
4. Should generated app pages show a shell refresh icon in addition to retry-on-error, or should retry be the only action until refresh semantics are proven?
5. Does the current build script accept a package id argument for a focused rebuild, or should the exact supported invocation be documented before Commit 1?
