# Slurp2 settings UI — round 2

Status: built in 0.2.74 (2026-09-26), all 7 slices. Differences from the plan below:
search stays in the page header (compact) instead of moving to the sidebar; Posting is one page
with groups (Pace, Stories, What gets posted) instead of three pages; World keeps Events and
Calendar as two pages; the image setup wizard stays (a regression keeps it reachable). Found on
the way: the Connections "Image generation" row saved `imageGenerationConnectionId`, which only
ads read; it now edits the Creator picture default, and ad images fall back to that default.
The phone settings home uses the shell's 1024 px container query, not `md`, because the side
menu only appears at that width.

Proposal written against 0.2.73 as installed on prod (`ssh marinara`). Round 1
(`SETTINGS-UI-REDESIGN.md`, 0.2.62–0.2.72) replaced controls one by one: segmented choices,
sliders, steppers, chip lists, status chips, 9 sections, 7 creator tabs. The controls are better,
but the pages still read as long stacks of full-width text. Round 2 is about **layout, page
structure, duplication and naming**, not about single controls.

Evidence: screenshots of all 21 backstage pages, the 7 creator tabs, and phone views at 390 px,
taken read-only from prod (`~/.cache/slurpshots/` on devbox).

Client paths are relative to `packages/slurp2/src/engine/packages/client/src/slp/`.

## 1. What is wrong (by cause, not by page)

### 1.1 Every setting is a full-width stack

`Field`, `Toggle`, `NumberSetting`, `ChoiceSetting` (`modules/settings/SlpSettings*.tsx`) all
render: label → description paragraph → control, each 100 % wide. Results on a 1440 px screen:

- A number like `3` sits in a 1100 px input (Messaging "Messages per reply", Coins "Unlock a post",
  Publishing "Posts per day" stepper).
- Segmented controls stretch to 1100 px, so three short words float far apart (Audience, Ads,
  Publishing "Stories").
- Toggles use a tinted row box; fields use no box. Two visual systems on one page.
- Pages are long: Writing 6 248 px, Ads 3 438 px, Publishing 1 959 px, Audience 2 788 px.

### 1.2 Each page says its name three times

Header card: eyebrow `FANS & MONEY` + title `Ads`. Body: `h2` `Ad controls`. Often the body title
differs from the nav label, so the user cannot tell whether they are on the page they clicked:

| Nav label               | Header title        | Body title       |
| ----------------------- | ------------------- | ---------------- |
| Improve with AI         | Improve with AI     | Creator workshop |
| Coins and access        | Coins and access    | SlurpCoins       |
| Discovery               | Discovery           | Tags             |
| Ads                     | Ads                 | Ad controls      |
| Automation overview     | Automation overview | Posting          |
| Writing & content level | Prompts             | Prompt Studio    |

Around the title: an "All Slurp" scope badge on every page (no page is scoped otherwise), a
"Changes save automatically." pill, a search box, and a "N settings differ from the defaults ·
Reset section" banner. The first thing on most pages is the destructive reset action.

### 1.3 Three hubs show the same thing

- Overview: status hero, Needs attention, Quick switches, Activity, 5 area tiles.
- Posting → Automation overview: manual actions + Pause/Fine-tune rows for publishing, storylines,
  images, audience, replies, AI writing.
- World → All areas: Fine-tune rows for Audience, World simulation, Discovery tags, Messaging,
  Coins, Ads + Libraries. After the round-1 split, 5 of these 6 rows are **Fans & money** pages.

Also duplicated: the Maintenance health card appears on both Maintenance pages; the global image
connection is on Connections _and_ on Image generation; "Improve with AI" is a sub-page, a button
on Creator management, and the creator Tools tab.

### 1.4 Names collide

- Section **Stories** = storylines, types, packs. But a **Story** is also the short-lived image
  post (Publishing "Stories: Regular", Image generation "Story images", "Story lifetime").
- "Text generation" vs "AI writing (replies, messages, activity)" on Connections: the difference is
  not visible from the names.
- Creator modal Tools tab has a jump chip "Delete" next to "Improve"; it looks like a button.

### 1.5 Things live in the wrong place

- "Carryover to chats" (Engine chats remember Slurp activity) sits inside Publishing pace.
- "World timeline" sits at the bottom of Packs.
- "Story images" (size, lifetime, auto on/off) sits in Image generation; the Story cadence sits in
  Publishing.
- Content level ("How far pictures go") is the most used control on Writing & content level but is
  the second card, below a full prompt text.

### 1.6 Long explanations sit on top of the controls

Ads (3 paragraphs), SlurpCoins (2 paragraphs), Storylines ("Set the storyline rules once" box),
Events ("Whether events start by themselves is set under …"), Posting schedule. These push the
controls below the fold and are read once.

### 1.7 Lists are cards with empty space

- Storyline types: each type is a 180 px card; Edit/Export/Delete in a separate footer row;
  "Enabled" is a checkbox; Import, "Describe to AI", and "Add storyline type" are scattered below.
- Ad pool: 150 px cards with a vertical icon column.
- Events: `01/01 · 1 days`.
- Calendar: an empty 6-week grid (1 000 px) with no events; filter chips look like buttons.

### 1.8 Phone

At 390 px the header card (eyebrow, title, search, save pill) plus a native "Destination" select
with 21 options take 380 px before the first setting. There is no settings home to return to.

### 1.9 Creator modal

- Name/avatar shows in the modal title, the rail, and the Overview hero. "View profile" in the
  rail and "Profile ↗" in the hero do the same thing.
- Jump chips (Identity · Appearance · Wardrobe) look like tabs but only scroll; no chip shows as
  current.
- Profile has a Save/Cancel bar; every other tab saves at once. No hint explains the difference.
- Posting tab: the only Automation content is one "Auto-post" switch in a large card.

## 2. Design

### 2.1 Settings row (fixes 1.1 — biggest single win, one shared change)

All controls render as a **row**: text column left (label, one-line description, max 60ch), control
right at natural width. On `< md` the control wraps below the text. Rows sit in a **group card**
with hairline dividers, no per-row boxes.

```
┌ Replies ───────────────────────────────────────────────────────────────┐
│ Answer while you are away                                       [ ●○ ] │
│ A Creator answers messages you left open, in the background.           │
├────────────────────────────────────────────────────────────────────────┤
│ Messages per reply                                        [ − 3 + ]    │
│ A long reply is split into this many messages.                         │
├────────────────────────────────────────────────────────────────────────┤
│ Who can start a conversation     [Anyone|Subscribers|Paid request|No]  │
└────────────────────────────────────────────────────────────────────────┘
```

- `Field`, `Toggle`, `NumberSetting` (compact width + unit suffix), `ChoiceSetting` (`fit` width
  when ≤ 4 short options, full width only for preset cards) get a shared `SettingRow` frame.
- `SettingsGroup` becomes the card with dividers (today it only adds an eyebrow).
- Long `detail` text over ~140 chars moves into a `(i)` popover (`HelpHint` already exists as the
  `?` icon next to labels) — the row keeps one line.
- Anchors (`SettingAnchor`, `settingKey`) do not change.

### 2.2 Page frame (fixes 1.2)

```
Fans & money › Ads                                     ✓ Saved   ⌕ Find
Ads
Made-up ads between posts. How this works ▸
[ Ads in the feed ● ]  [ Every 4 posts ]  [ Tame only ]      ← status chips, hubs only
```

- One title = the nav label. Body `h2` titles that repeat it are deleted; a body title stays only
  when a page has several groups.
- Breadcrumb replaces the eyebrow. Sub-page pills stay under the title.
- "All Slurp" badge removed (scope badge stays only where scope is _not_ global: creator modal).
- "Changes save automatically." → a small save state ("Saved" / "Saving…" / "Not saved — retry")
  next to the title.
- Search moves to the sidebar top (desktop) and the settings home (phone).
- "Reset section" moves to the page footer: "6 settings differ from the defaults · Reset page".
- Long explanations (1.6) fold into "How this works ▸" under the page description.

### 2.3 Information architecture (fixes 1.3–1.5)

```
Overview                 ← the only hub: status, needs attention, quick switches, manual actions
Connections              ← renamed from "Models & connections"; one row per operation
  Text & images · Chats
Creators
  All creators · Improve with AI
Posting
  Pace & schedule · What gets posted · Image posts & Stories
Storylines               ← renamed from "Stories" (1.4)
  Rules · Types · Packs
World
  Calendar & events       ← one page: agenda list first, month grid optional
Fans & money
  Audience · Messages · Coins · Ads · Tags
Writing
  Content level (top) · Prompts
Maintenance              ← one page: health once, Storage, Cleanup, Backup
```

- Posting → "Automation overview" is deleted; its manual actions and Pause rows join Overview's
  quick switches (Overview already shows the same state).
- World → "All areas" is deleted (stale hub).
- "Carryover to chats" moves to Connections → Chats.
- "Story images" (auto on/off, lifetime, size) moves next to the Story cadence in Posting →
  "Image posts & Stories", together with post image size.
- Image generation keeps connection/context/style; the duplicate global image connection row goes
  (Connections owns it).
- "World timeline" moves from Packs to World → Calendar & events.
- Old destinations keep working through `SLP_LEGACY_SETTINGS_DESTINATION`.

### 2.4 Phone (fixes 1.8)

Settings home = a grouped list (icon, name, current-value summary, chevron) with search on top.
Tapping pushes the page with a back row ("‹ Settings"). No Destination select. Sub-page pills scroll
horizontally under the title. The slim frame (2.2) leaves the first setting at ~180 px.

### 2.5 Lists (fixes 1.7)

One `SettingsList` pattern: row = leading visual (thumb/icon), title + one meta line, trailing
switch, overflow menu (`⋯`: Edit, Export, Delete). Add/Import/AI create sit in one toolbar above
the list. Used by Storyline types, Ad pool, Events, Packs, character overrides.
Events meta: "Jan 1 · 1 day" (locale date, plural rules).

### 2.6 Creator modal (fixes 1.9)

- Modal title shows the name; the rail loses the duplicate identity block; "View profile" stays
  once (rail footer).
- Jump chips become an in-page "On this page" list with scroll-spy (current chip marked), or are
  removed where a tab has only 2 blocks.
- Profile: sticky Save bar with "Unsaved changes" text; other tabs keep instant save and the same
  save state as 2.2.
- Tools: Improve only; Delete becomes a danger zone at the bottom of Tools, not a chip.
- Posting tab: Auto-post becomes a header row of the tab ("Auto-post ● · next post 12:26 AM").

## 3. Build plan

Order by value ÷ risk. Each slice: architecture regression, typecheck, affected regressions,
`heavy` build of slurp2, screenshots at 390/768/1440.

| #   | Slice                                                                                                                                                                                         | Main files                                                                                                            |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 1   | `SettingRow` + group card with dividers; compact number/segmented widths; long detail → hint                                                                                                  | `modules/settings/SlpSettingsControls.tsx`, `SlpSettingsInputs.tsx`                                                   |
| 2   | Page frame: one title, breadcrumb, save state, reset to footer, drop "All Slurp", "How this works" fold                                                                                       | `SlpSettingsKit.tsx` (`BackstagePageHeader`), `app/backstage/SlpBackstageShell.tsx`, panels' `SectionTitle` calls     |
| 3   | IA: delete Automation overview + All areas hubs, move Carryover, Story images, World timeline; rename Stories → Storylines, Models & connections → Connections; merge Maintenance; legacy map | `base/navigation/slp-backstage-target.ts`, `app/backstage/slp-backstage-registry.ts`, `features/backstage/*`, locales |
| 4   | Phone settings home + push navigation                                                                                                                                                         | `features/backstage/SlpBackstageNavigation.tsx`, `SlpBackstageSidebar.tsx`, shell                                     |
| 5   | `SettingsList` for types, ads, events, packs                                                                                                                                                  | `modules/settings/`, story/ads/events panels                                                                          |
| 6   | Creator modal clean-up                                                                                                                                                                        | `features/creators/settings/*`                                                                                        |
| 7   | Writing: content level card on top, prompt texts fold to 3 lines                                                                                                                              | `features/settings/SlpPromptsPanel.tsx`, `SlpBackstageKit.tsx` (`PromptCard`)                                         |
