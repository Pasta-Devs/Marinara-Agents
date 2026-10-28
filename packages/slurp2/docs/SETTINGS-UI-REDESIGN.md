# Slurp2 settings UI redesign

Status: proposal, 2026-09-25, against 0.2.61 (`laser-guided-slurp`). Nothing here is built yet.

Goal (user): "In settings and creator settings we can reorder, prettify and use much better UI; not
everything has to be a dropdown or list."

Client paths below are relative to `packages/slurp2/src/engine/packages/client/src/slp/`.

## 0. Ground rules this proposal was checked against

- **Tailwind classes exist at runtime.** `scripts/build-feature-packages.mjs:932` `buildPackageStyles`
  compiles `globals.css` plus `@source packages/client/src/**/*.{ts,tsx}` of the package build root
  with `@tailwindcss/vite`, scopes it, and `:1659-1663` injects it for `slurp2` via
  `setSlurpPackageStyles`. So the Engine safelist does not limit Slurp2 classes. Still confirm
  visually.
- **Tokens only.** Surfaces/text: `--slurp-canvas`, `--slurp-surface`, `--slurp-surface-raised`,
  `--slurp-text`, `--slurp-muted`, `--slurp-outline`, `--slurp-focus`, `--slurp-nav-active`,
  `--slurp-shadow-raised`. Semantic: `--slurp-success`, `--slurp-warning`, `--slurp-danger`,
  `--slurp-violet`, `--slurp-coral`. Accent: `--noodle-accent`, `--noodle-accent-foreground`
  (defined in `base/chrome/SlpChrome.tsx`). No new tokens are needed.
- **Architecture test** (`tests/slurp2-architecture.regression.ts`): files ≤ 800 lines; layers
  `base ← modules ← features ← app`; cross-feature imports only via `slp-*-contract.ts`.
  `features/creators/settings/SlpCreatorSettingsSections.tsx` is at **784 lines** — any growth there
  fails the gate, so slice 6 splits it.
- **Anchors**: every persisted setting keeps its `settingKey` anchor
  (`tests/slurp2-backstage-anchors.regression.ts`). New controls take `settingKey` and render
  `SettingAnchor` exactly like `Field`/`Toggle` do today.
- **Dependencies**: none added. `lucide-react` icons, native `<input type="radio|range|time|date">`,
  `<details>`, and the existing `focusSettingAnchor` cover everything below.
- Mobile first: 390 px, 44 px targets (`min-h-11`), no horizontal scroll, `dvh` not `vh`.
  Sentence case. Every string through `locales/en.json` (+ de/ko/pl keys with English fallback).

## 1. Current-state inventory

Counts from the component source (`sel` = `<select>`, `tog` = Toggle, `num` = number input,
`ta` = textarea, `dt` = date/time input).

### Backstage (global settings)

Section order today: Overview · Creators · World · Stories & events · Posting · Writing & content
level · Maintenance (`base/navigation/slp-backstage-target.ts:1`).

| Section → page                       | File                                                                          | Controls                                                                          | Main pain points                                                                                                  |
| ------------------------------------ | ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Overview                             | `features/backstage/SlpBackstageOverviewPanel.tsx`                            | 4 tog, 4 overview cards                                                           | Fine. Master switches are good.                                                                                   |
| Creators → Creator management        | `features/creators/SlpCreatorsPanel.tsx`                                      | roster list, continuity overview                                                  | Fine; entry point to the modal.                                                                                   |
| Creators → Improve with AI           | `SlpCreatorImprovePanel.tsx`                                                  | AI checkup                                                                        | Fine.                                                                                                             |
| World → All areas                    | `SlpBackstageWorldPanel.tsx`                                                  | hub rows                                                                          | Hub page only.                                                                                                    |
| World → Discovery                    | `features/discovery/SlpTagsPanel.tsx`                                         | tag editor                                                                        | Fine.                                                                                                             |
| World → Audience                     | `features/audience/SlpAudiencePanel.tsx` + Config/FanTypes/Simulation/Ambient | ~6 sel, 6 tog, 18 num, 3 ta, 6 ChoiceRow, wizard                                  | Longest page; number walls for fan weights and per-refresh caps.                                                  |
| World → Messaging rules              | `features/messages/SlpMessagingPanel.tsx`                                     | 2 sel, 3 tog, **15 num** (10 are min/max pairs), wizard                           | Ten lone number boxes for five ranges.                                                                            |
| World → Ads                          | `features/ads/SlpAdsPanel.tsx`                                                | **9 sel** (5 are 3–5 fixed options), 2 tog, 3 ta                                  | Dropdown stack for small enums.                                                                                   |
| World → Coins and access             | `features/economy/SlpWalletPanel.tsx`                                         | 2 tog, 10 num                                                                     | Percent/hour values as raw numbers.                                                                               |
| Stories & events → hub               | `SlpBackstageContentPanel.tsx`                                                | 5 rows                                                                            | Hub only; hardcoded English strings (lines 13–38).                                                                |
| → Storylines                         | `features/projects/SlpStorylinesPanel.tsx`                                    | 4 preset pills, **6 sel** (all 3–4 fixed options), 6 tog, 3 num, Advanced         | Pills and selects for the same kind of choice; select class copy-pasted 5×.                                       |
| → Events                             | `features/world/SlpPlatformEventsPanel.tsx`                                   | 3 sel, 2 num, 1 ta, 1 dt                                                          | OK (event editor).                                                                                                |
| → Calendar / Storyline types / Packs | `SlpCalendarPanel`, `SlpProjectsPanel`, `SlpStoryPacksPanel`                  | views, library editor                                                             | Out of scope (content, not settings).                                                                             |
| Posting → Automation overview        | `SlpBackstageAutomationPanel.tsx`                                             | hub rows                                                                          | Hub only.                                                                                                         |
| Posting → Publishing                 | `features/feed/SlpPublishingPanel.tsx`                                        | 4 preset cards + Custom, **6 sel**, 4 tog, 5 num, wizard, hand-rolled `<details>` | Pace presets exist twice (cards on page **and** the "Set Slurp's pace" wizard); `storyRate` select appears twice. |
| Posting → Image generation           | `features/media/SlpImagesPanel.tsx`                                           | 6 sel, 7 tog, 7 num, wizard                                                       | Width/height as number pairs; 3-option enums as selects.                                                          |
| Posting → Connections                | `features/settings/SlpConnectionsPanel.tsx`                                   | 1 sel                                                                             | Fine (dynamic list).                                                                                              |
| Writing & content level → Prompts    | `features/settings/SlpPromptsPanel.tsx` (+ block builder)                     | 1 sel, 2 tog, editors                                                             | Content level is buried inside a prompt studio.                                                                   |
| Maintenance → Storage and cleanup    | `features/maintenance/SlpAutopurgePanel.tsx`                                  | 1 sel, 3 tog, 1 num, 1 dt                                                         | Fine.                                                                                                             |
| Maintenance → Backup and data        | `SlpBackupPanel.tsx`                                                          | actions                                                                           | Fine.                                                                                                             |
| Mobile navigation                    | `features/backstage/SlpBackstageSidebar.tsx:76-100`                           | one `<select>` with optgroups                                                     | The whole Backstage is a dropdown on phones.                                                                      |

### Creator settings modal (14 tabs, `features/creators/settings/slp-creator-settings-sections.ts`)

| Tab (group)                      | Renders                                                                    | Controls                                                                                                                       | Main pain points                                                                                                                                              |
| -------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Overview (creator)               | `SlpCreatorOverviewSection`                                                | banner, status note, 10 link tiles                                                                                             | Tiles only repeat tab names; no real status (next posts, storylines, memory). Modal opens on **Identity**, not Overview (`slp-creator-settings-store.ts:39`). |
| Identity (creator)               | `SlurpCreatorProfileEditor` + `SlpStageProfileForm`                        | profile form, artwork uploads, 1 ta                                                                                            | **Bug**: content squeezed to ~160–240 px, Save bar floats mid-right (§5.1).                                                                                   |
| Appearance (creator)             | `SlpCreatorIdentitySection appearanceOnly`                                 | status + up to 6 action buttons + 1 ta                                                                                         | Fine; small.                                                                                                                                                  |
| Wardrobe (creator)               | `SlpWardrobeManager`                                                       | 4 sel, 2 ta                                                                                                                    | Fine; big manager (540 lines).                                                                                                                                |
| Audience activity (creator)      | `SlpCreatorAudienceSection`                                                | 1 sel (inherit/on/off), 6 num                                                                                                  | "Global (x)" option inside a select; six lone weight boxes.                                                                                                   |
| Automation (publishing)          | `SlpCreatorPublishingSection mode=automation`                              | 1 tog, **one `datetime-local` + Save button per slot** (often 8)                                                               | Heavy form for "move a post".                                                                                                                                 |
| Content rules (publishing)       | same, `mode=content-rules`                                                 | 5 level pills ("Use shared (x)" + 4), 3 guidance fields                                                                        | Inherit pill reads like a 5th level.                                                                                                                          |
| Production (publishing)          | `SlpCreatorImagesSection` + `SlurpCreatorStrategyGroup`                    | 1 tog, 3 sel with "Use global" option, 1 sel, 1 num, 1 ta                                                                      | Global-in-dropdown pattern again.                                                                                                                             |
| Collaborations (publishing)      | `CreatorCollabsEditor`                                                     | partner editor                                                                                                                 | Fine.                                                                                                                                                         |
| Messages & pricing (interaction) | `CreatorMessagingGroup`                                                    | 1 sel, 2 tog, 7 num                                                                                                            | Fine; could use pairs.                                                                                                                                        |
| Storylines (memory)              | `ArcConfigSection` (`features/projects/SlpArcConfigSection.tsx`)           | **7 sel each with "Global (x)"**, checkbox list                                                                                | `text-[0.7rem]`, `py-1` selects (~28 px, below 44 px), old "Arc" naming ("Arc settings", "Arc speed"). Worst tab.                                             |
| Continuity (memory)              | `SlurpContinuityPanel` + `SlpCanonAnchorsEditor` + `SlpCreatorSignalsList` | 4 sel + 1 num + 2 datetime filters, search, per-fact "Publish to…" select, **7 textareas** + 2 sel (Life details), signal list | Filters look heavy; **raw ids** in Recent plans (§5.2); one-per-line textareas for lists.                                                                     |
| Improve (tools)                  | `SlurpCreatorImprover`                                                     | AI checkup                                                                                                                     | Fine.                                                                                                                                                         |
| Remove (danger)                  | `SlpCreatorDangerSection`                                                  | 1 button                                                                                                                       | A whole tab for one button.                                                                                                                                   |

## 2. New information architecture

### 2.1 Backstage sections (decided 2026-09-25)

"World" held Discovery, Audience, Messaging rules, Ads and Coins — fans and money, not the world —
while the real world pages (Events, Calendar) sat in "Stories & events". Connections was the 4th
page of Posting. Decided split, in frequency order:

```
Overview · Models & connections · Creators · Posting · Stories · World · Fans & money · Writing & content level · Maintenance
```

| Section (id)                        | Pages (targets)                        |
| ----------------------------------- | -------------------------------------- |
| Overview (`overview`)               | overview                               |
| Models & connections (new `models`) | connections, images                    |
| Creators (`creators`)               | creators, improve                      |
| Posting (`automation`)              | automation, general                    |
| Stories (`content`)                 | storylines, arcs, packs                |
| World (`world`)                     | world (hub), events, calendar          |
| Fans & money (new `fans`)           | audience, messaging, wallet, ads, tags |
| Writing & content level (`prompts`) | prompts                                |
| Maintenance (`maintenance`)         | autopurge, advanced                    |

- Models & connections sits directly below Overview so the text/image connection is one click away.
- Old destinations keep working: `SLP_LEGACY_SETTINGS_DESTINATION` maps old section/target pairs
  (e.g. `automation:connections`, `world:audience`, `content:events`) to the new ones.
- The World hub page (`world`, "All areas") is re-scoped to world pages only; its fans/money cards
  move to a Fans & money hub or are dropped if the hub adds nothing.
- Section/target ids that are persisted or deep-linked are kept; only `models` and `fans` are new.

Writing & content level page: move the content level (`explicitLevel` cards) to the **top** of the
Prompts page, above the prompt studio. It is the only frequently used control there.

### 2.2 Creator modal: 14 tabs → 7 (decided: Wardrobe goes into Profile)

Order follows "who they are → what they post → who they talk to → what they remember → tools".

| New tab         | Contains (existing section components, reused as-is unless noted)                                          | Old ids that alias here                                    |
| --------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------- |
| Overview        | dashboard (§4.4)                                                                                           | `overview`                                                 |
| Profile         | Identity form, then Appearance card, then Wardrobe ("Looks" block)                                         | `identity`, `appearance`, `wardrobe`                       |
| Posting         | Automation (toggle + schedule agenda), Production (images, strategy), Storylines overrides, Collaborations | `automation`, `production`, `storylines`, `collaborations` |
| Content rules   | level, public/locked guidance, content menu                                                                | `content-rules`                                            |
| Fans & messages | Audience activity, Messages & pricing                                                                      | `audience`, `messages`                                     |
| Memory          | Waiting for you, Life details, What they remember, Recent plans, What happened, Signals                    | `continuity`                                               |
| Tools           | Improve, then a danger block with Remove at the bottom                                                     | `improve`, `danger`                                        |

- Merged tabs render the existing section components in a row with an `h2` per block and a short
  jump-chip row at the top (the same `StatusStrip` control, §3.6). No section logic changes.
- Deep links (`openSlpCreatorSettings(id, { tab: "automation" | "identity" | "continuity" })` in
  `SlpScreenProfile.tsx:575`, `SlpHomeCreatorFlow.tsx:334/430`, `SlpCreatorsPanel.tsx:90/295`) keep
  working through a `SLP_LEGACY_CREATOR_TAB` alias map: old id → `{ tab, anchor }`. Same pattern as
  `SLP_LEGACY_SETTINGS_DESTINATION`.
- 7 tabs fit the phone section sheet without scrolling and the desktop rail without group headers
  (group labels are deleted).
- Default tab when the modal opens becomes Overview once the dashboard exists.

## 3. Control catalogue

All new shared controls are props-only and live in `modules/settings/`. They import no feature.
`SlpSettingsControls.tsx` is 209 lines; the choice/override/chip controls go in a new
`modules/settings/SlpSettingsInputs.tsx` so both files stay small.

### 3.1 `ChoiceSetting` — segmented control and preset cards (ideas 1 + 2, merged)

One component, two densities. It replaces three hand-rolled versions of the same thing: `ChoiceRow`
(`SlpBackstageKit.tsx:31`, delete), the story-activity pills (`SlpStorylinesPanel.tsx:46-60`), the
pace cards (`SlpPublishingPanel.tsx:179-215`) and the explicit-level pills
(`SlpCreatorPublishingSection.tsx:128-156`).

```ts
type ChoiceOption<T extends string> = {
  value: T;
  label: string;
  detail?: string; // cards only: one line under the label
  icon?: LucideIcon; // cards only
};
function ChoiceSetting<T extends string>(props: {
  label: string;
  detail?: string;
  settingKey?: SlpSettingKey;
  options: readonly ChoiceOption<T>[];
  value: T | null; // null = no option matches ("Custom" shown by caller)
  onChange: (value: T) => void;
  variant?: "segmented" | "cards"; // default "segmented"
  disabled?: boolean;
  disabledReason?: string | null;
});
```

- Semantics: `<fieldset>` + `<legend>`, one visually hidden native `<input type="radio">` per option
  inside a styled `<label>`. Arrow keys, form semantics and screen-reader "1 of 3" come free.
- Segmented: `grid grid-flow-col auto-cols-fr` in one `min-h-11` track with `--slurp-nav-active`
  on the checked item. Falls back to `flex-wrap` when there are more than 3 options or a label is
  longer than ~12 characters, so 390 px never scrolls sideways.
- Cards: `grid gap-2 sm:grid-cols-2 lg:grid-cols-4`, `min-h-16`, icon + label + one detail line.
- Rule of use: segmented for 2–4 fixed options with short labels; cards when each option needs a
  one-line consequence (presets, post planner); keep `<select>` for dynamic lists (connections,
  style profiles, lorebooks) and for more than 5 options.

Settings that move to it:

| Variant          | Settings                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| cards            | story activity presets, pace presets (+ Custom), `postPlanner` (Beats / Classic), explicit level                                                                                                                                                                                                                                                                              |
| segmented        | `storyAutomation`, `arcAutoMode`, `projectRate`, `arcPace`, `arcSource`, `arcStatEffects`, `storyRate`, `teaserRate`, `autoPostGenerationMode`, `imageContextMode`, `appearanceProfileMode`, `inlineAdsFrequency`, `inlineAdsSteering`, `inlineAdsContentCeiling`, `inlineAdsEra`, `messagesDefaultDmPolicy`, simulation funnel, Life details heat min/max, creator DM policy |
| stays `<select>` | `inlineAdsTone` (5 long labels), all connection/style/lorebook pickers, retention unit, Wardrobe                                                                                                                                                                                                                                                                              |

### 3.2 `RangeSetting` — slider with value chip (idea 3, refined)

Only for bounded, small ranges where the relative position matters. Exact money values stay typed.

```ts
function RangeSetting(props: {
  value: number;
  min: number;
  max: number;
  step?: number;
  format?: (value: number) => string; // "3 weeks", "07:00", "40 %"
  onSave: (value: number) => Promise<boolean> | boolean | void;
  disabled?: boolean;
});
```

- Native `<input type="range" class="h-11 w-full accent-[var(--noodle-accent)]">` (44 px hit area)
  plus a `tabular-nums` chip showing `format(value)`. Saves on `pointerup`, `keyup` and `blur`, not on
  every move.
- Reuses NumberSetting's queued-save logic: extract it into `useQueuedSave(value, onSave)` in the
  same file; NumberSetting and RangeSetting both call it (no duplicate queue).
- Users: `arcCooldownWeeks` (1–8), `arcMaxConcurrentAuto` (1–20), `pricingMaxWeeklyChangePercent`,
  `walletCreatorRevenueSharePercent`, `walletDayStartHour` (format as clock), fan likes/replies per
  refresh, creator fan-type weights (0–100), continuity minimum confidence filter.
- Rejected: dual-thumb range sliders (no native control, poor keyboard/touch accessibility).

### 3.3 `NumberSetting stepper` and `RangePairField`

- `NumberSetting` gains `stepper?: boolean`: `−` and `+` buttons (`size-11`) around the existing
  input. Users: `postsPerDay`, `arcPollHours`, `carryoverHours`, `carryoverMaxItems`, image count caps.
  One prop, no new component.
- `RangePairField` is layout only: one label, two `NumberSetting`s side by side (`grid grid-cols-2`,
  fits 390 px), "to" between, unit suffix, inline error when min > max.

```ts
function RangePairField(props: {
  label: string;
  detail?: string;
  unit: string;
  min: { settingKey: SlpSettingKey; value: number; onSave: (v: number) => unknown };
  max: { settingKey: SlpSettingKey; value: number; onSave: (v: number) => unknown };
  bounds: [number, number];
});
```

Users: the five messaging delay pairs (10 inputs → 5 rows), image width × height, story image
width × height.

### 3.4 `OverrideField` — "Own value" instead of "Global (x)" options (idea 6, accepted)

```ts
function OverrideField(props: {
  label: string;
  detail?: string;
  settingKey?: SlpSettingKey;
  inheritedValue: string; // already localized, e.g. "Suggest"
  overridden: boolean;
  onOverride: () => void; // writes the current global value as this Creator's value
  onReset: () => void; // deletes the override
  disabled?: boolean;
  children: ReactNode; // the real control; rendered only while overridden
});
```

- Collapsed: label, muted chip "Uses Slurp setting: Suggest", and a compact switch "Own value".
- Overridden: the switch is on, the chip turns into a quiet reference ("Slurp setting: Suggest") and
  the control appears under it. Turning the switch off calls `onReset`.
- Replaces every inherit-in-a-dropdown: `ArcConfigSection` (7 fields + type list), creator fan
  activity mode and weights, creator image connection, image style, character image instructions,
  explicit level ("Use shared (x)" pill), creator DM policy/prices if they inherit.
- `ArcConfigSection` is rewritten on this plus `ChoiceSetting`/`RangeSetting`: 44 px targets,
  `text-sm`, "Storylines" naming (drops "Arc settings", "Arc speed", "Arcs running at once").
  "Reset to global" becomes "Use Slurp settings for all".

### 3.5 `ChipListInput` — list editor (idea 9, accepted)

```ts
function ChipListInput(props: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
});
```

- Chips wrap (`flex flex-wrap gap-2`), each with a `size-11` remove button (visual 20 px icon).
  Enter or comma adds; Backspace on an empty input removes the last chip. Tap a chip to edit it in
  place. Labels truncate with `max-w-full truncate` so long names never widen the page.
- Life details keeps its storage and parser: the editor maps `draft[field].split("\n")` ↔
  `values.join("\n")`, so `slp-canon-anchor-text.ts` is unchanged. "Name — relation" stays one chip.
  Routine stays a textarea (time + activity pairs are not chip-shaped).

### 3.6 `StatusStrip` — page summary (idea 4, refined)

A sentence with clickable fragments does not survive translation (word order differs in de/ko/pl,
and the repo has no `<Trans>` usage). Use a row of labelled chips instead:

```ts
function StatusStrip(props: {
  items: { label: string; value: string; settingKey?: SlpSettingKey; tone?: SummaryTone }[];
});
```

- Renders `Posts: 6 a day · Stories: rare · Quiet at night: on`. A chip with `settingKey` is a
  button that calls the existing `focusSettingAnchor(settingKey)` (opens folded Advanced blocks,
  scrolls, focuses). Wraps on phones, `min-h-11` chips.
- Goes under `BackstagePageHeader` on Storylines, Publishing, Images, Audience, Messaging, and as
  the jump row at the top of merged creator tabs.

### 3.7 `AdvancedGroup` — one disclosure (idea 5, accepted with a rule)

`FineTune` (`SlpSettingsKit.tsx:118`) and `AdvancedGroup` (`SlpSettingsControls.tsx:195`) are the
same `<details>` twice, and Publishing has a third hand-rolled one (`SlpPublishingPanel.tsx:383`).
Keep `AdvancedGroup`, add optional `count` and `icon`, delete `FineTune` and the inline copy.
Rule: every page with more than about six controls folds the rarely changed ones; never nest.

### 3.8 `SectionSheet` — phone section picker

The creator modal already has a good bottom-sheet section picker (`SlpCreatorSettingsModal.tsx:301-376`).
Move it to `modules/settings/SlpSectionSheet.tsx` and use it for the Backstage phone navigation too,
replacing the `<select>` in `SlpBackstageSidebar.tsx:76-100`. Net code goes down.

### Ideas rejected or narrowed

| Idea                               | Decision                                                                                                                   |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| 1 Segmented controls               | Accepted, merged with 2 into `ChoiceSetting`.                                                                              |
| 2 Preset cards                     | Accepted as `ChoiceSetting variant="cards"`.                                                                               |
| 3 Sliders/steppers                 | Narrowed: sliders only for bounded small ranges; prices stay typed; no dual-thumb.                                         |
| 4 Summary sentence                 | Changed to a chip strip (i18n).                                                                                            |
| 5 Advanced folded                  | Accepted; one primitive, one level.                                                                                        |
| 6 Own-value override               | Accepted as `OverrideField`.                                                                                               |
| 7 Overview dashboard               | Accepted, built from existing hooks and `OverviewCard`.                                                                    |
| 8 Day timeline                     | Narrowed to a day agenda (vertical); a horizontal 24 h strip is cramped at 390 px and drag is not keyboard-friendly.       |
| 9 Chip editors                     | Accepted for list fields; routine stays text.                                                                              |
| 10 Fewer tabs, re-ordered sections | Accepted: 14 → 8 tabs, frequency-first Backstage order.                                                                    |
| Extra                              | Remove the Publishing "Set Slurp's pace" wizard: it repeats the preset cards and `storyRate` that are already on the page. |

## 4. Per-page redesign

### 4.1 Backstage → Stories & events → Storylines

Before: 4 pills, then 2 selects, then 2 selects + 2 toggles, 2 toggles, Advanced (2 selects, 3
numbers, 2 toggles).

After:

```
390 px                                   1440 px (content column ~ 880 px)
┌──────────────────────────────┐        ┌──────────────────────────────────────────────────────────┐
│ Storylines          All Slurp│        │ Storylines                                     All Slurp │
│ How stories start and move.  │        │ How stories start and move.                              │
│ [Starts: suggest][Pace: norm]│        │ [Starts: suggest] [Events: auto] [Pace: normal] [Often:…]│
│ [Events: auto]               │        │                                                          │
│ Story activity               │        │ Story activity                                           │
│ ┌────────────┐┌────────────┐ │        │ ┌──────────┐┌──────────┐┌──────────┐┌──────────┐         │
│ │☾ Calm      ││✦ Lively    │ │        │ │☾ Calm    ││✦ Lively  ││➤ Hands-  ││⚙ Custom  │         │
│ │few, slow   ││more, faster│ │        │ │few, slow ││more, fast││off  auto ││your mix  │         │
│ └────────────┘└────────────┘ │        │ └──────────┘└──────────┘└──────────┘└──────────┘         │
│ ┌────────────┐┌────────────┐ │        │ ┌ Start by themselves ───────┐┌ How storylines behave ──┐│
│ │➤ Hands-off ││⚙ Custom    │ │        │ │Events   [Off|Suggest|Auto] ││How often [Off|Rare|Reg|…]││
│ └────────────┘└────────────┘ │        │ │Storylines[Off|Suggest|Auto]││Speed   [Slow|Normal|Fast]││
│ ┌ Start by themselves ─────┐ │        │ └────────────────────────────┘│Mood effects        (●)  ││
│ │Events                    │ │        │                               │Fan reactions       (●)  ││
│ │[ Off ][Suggest][ Auto  ] │ │        │                               └─────────────────────────┘│
│ │Storylines                │ │        │ ┌ Shared ideas ──────────────────────────────────────────┐│
│ │[ Off ][Suggest][ Auto  ] │ │        │ └────────────────────────────────────────────────────────┘│
│ └──────────────────────────┘ │        │ ▸ Advanced                                             7 │
│ ┌ How storylines behave ───┐ │        └──────────────────────────────────────────────────────────┘
│ │How often                 │ │
│ │[Off][Rare][Regular][Oft.]│ │   Advanced (folded): Source [Library|Generated|Mixed],
│ │Speed [Slow|Normal|Fast]  │ │   Cooldown ──●──── 3 weeks, At once ─●── 4,
│ │Mood effects          (●) │ │   Check every [−][ 24 ][+] h, Stat effects [Off|Small|Big],
│ └──────────────────────────┘ │   Director (●), Crossovers (●)
│ ▸ Advanced                 7 │
└──────────────────────────────┘
```

Two groups sit side by side from `lg`; one column below.

### 4.2 Backstage → Posting → Publishing

Before: refresh card, pace header + wizard button, 4 pace cards + Custom, conditional number, storyRate
select, quiet toggle, lengths, carryover, "What gets posted" selects, hand-rolled details.

After (order): StatusStrip → Pace cards (Manual/Occasional/Lively/Very active/Custom; Custom reveals the `postsPerDay`
stepper inline) → "Stories and teasers" (`storyRate`, `teaserRate` segmented, quiet hours toggle) →
"What gets posted" (`postPlanner` as two cards: _The Creator's life_ / _Model's choice_) →
"Refresh now" card → Advanced (lengths as steppers, carryover, generation mode segmented, text
connection select, Professor Mari toggle). The pace wizard is removed.

```
390 px                                   1440 px
┌──────────────────────────────┐        ┌──────────────────────────────────────────────────────────┐
│ Publishing          All Slurp│        │ Publishing                                     All Slurp │
│ [Pace: lively][Stories: rare]│        │ [Pace: lively] [Stories: rare] [Quiet: on]               │
│ How often Slurp posts        │        │ How often Slurp posts                                    │
│ ┌────────────┐┌────────────┐ │        │ ┌─────────┐┌──────────┐┌──────┐┌───────────┐┌────────┐ │
│ │Manual      ││Occasional  │ │        │ │Manual   ││Occasional││Lively││Very active││Custom  │ │
│ └────────────┘└────────────┘ │        │ └─────────┘└──────────┘└──────┘└───────────┘└────────┘ │
│ …  (2 per row)               │        │ ┌ Stories and teasers ───────┐┌ What gets posted ────────┐│
│ ┌ Stories and teasers ─────┐ │        │ │Stories [Off|Rare|Reg|Often]││┌───────────┐┌──────────┐││
│ │Stories                   │ │        │ │Teasers [Off|Rare|Reg|Often]│││The        ││Model's   │││
│ │[Off][Rare][Regular][Oft.]│ │        │ │Quiet at night          (●) │││Creator's  ││choice    │││
│ │Quiet at night        (●) │ │        │ └────────────────────────────┘││life       ││          │││
│ └──────────────────────────┘ │        │                               │└───────────┘└──────────┘││
│ ┌ What gets posted ────────┐ │        │ Refresh now  ……………………………………………………………… [✦ Refresh]  │
│ │┌──────────┐┌───────────┐ │ │        │ ▸ Advanced                                            8  │
│ ││Creator's ││Model's    │ │ │        └──────────────────────────────────────────────────────────┘
│ ││life      ││choice     │ │ │
│ │└──────────┘└───────────┘ │ │
│ └──────────────────────────┘ │
│ ▸ Advanced                 8 │
└──────────────────────────────┘
```

### 4.3 Creator modal → Posting tab (merged Automation + Production + Storylines + Collabs)

```
390 px (fullscreen modal)                1440 px (modal max-w-4xl, rail 13 rem)
┌──────────────────────────────┐        ┌────────────┬─────────────────────────────────────────┐
│ ‹ Mira's settings          ✕ │        │ (◉) Mira   │ Posting                                 │
│ [ Posting               ▾ ] │        │ @mira      │ [Auto: on][Next: 14:30][Images: on]     │
│ [Auto: on][Next 14:30][Img]  │        │            │ ┌ Automatic posting ─────────────────┐  │
│ Automatic posting        (●) │        │ Overview   │ │Post automatically              (●) │  │
│ Upcoming posts               │        │ Profile    │ └────────────────────────────────────┘  │
│ Today                        │        │ Wardrobe   │ Upcoming posts                          │
│ ┌──────────────────────────┐ │        │ ▌Posting   │ Today              Tomorrow             │
│ │ 14:30  Prepared      ✎  │ │        │ Content…   │ 14:30 Prepared ✎   09:15 Scheduled ✎    │
│ │ 18:00  Scheduled     ✎  │ │        │ Fans & msg │ 18:00 Scheduled ✎  13:40 Scheduled ✎    │
│ └──────────────────────────┘ │        │ Memory     │ Images                                  │
│ Tomorrow                     │        │ Tools      │ Post pictures                      (●)  │
│ ┌──────────────────────────┐ │        │            │ Image model  Uses Slurp setting: SDXL   │
│ │ 09:15  Scheduled     ✎  │ │        │            │                         Own value ( )   │
│ └──────────────────────────┘ │        │            │ Storylines                              │
│ Images                       │        │            │ Starting     Uses Slurp: Suggest  ( )   │
│ Post pictures            (●) │        │            │ Speed        Own value           (●)    │
│ Image model                  │        │            │              [Slow|Normal|Fast]         │
│  Uses Slurp setting: SDXL    │        │            │ Collaborations …                        │
│                Own value ( ) │        │            │                                         │
│ Storylines …                 │        └────────────┴─────────────────────────────────────────┘
└──────────────────────────────┘
```

Tapping ✎ on a slot turns the row into `[ 14:30 ]` (native `type="time"`) + "Another day" link
(native `type="date"`). The change saves on commit, like `NumberSetting`, with a toast on error and a
revert. No Save button per slot. Validation: the new time must be in the future (same rule as
`ScheduleSlotEditor` today).

### 4.4 Creator modal → Overview dashboard

Built from queries the modal already has or the contracts already export: `useCreatorReserveStatus`
(next slots), `creator.autoPosting`, `useSlurpContinuity` (waiting proposals count; gated by
`active`), storyline count via a `useSlurpArcs` export added to `slp-projects-contract.ts`. Tiles use
the existing `OverviewCard`.

```
390 px                                   1440 px
┌──────────────────────────────┐        ┌────────────┬─────────────────────────────────────────┐
│ ▓▓▓▓▓▓▓ banner ▓▓▓▓▓▓▓▓▓▓▓▓▓ │        │ rail       │ ▓▓▓▓▓▓▓▓▓▓▓▓ banner ▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓ │
│ (◉) Mira  @mira  [Edit prof.]│        │            │ (◉) Mira @mira              [Edit prof.]│
│ ⚠ Needs review: appearance   │        │            │ ⚠ Needs review: appearance  [Review ›]  │
│ ┌ Posting ─────────────────┐ │        │            │ ┌ Posting ──────────┐┌ Memory ─────────┐│
│ │ Auto on  (●)             │ │        │            │ │Auto on        (●) ││3 waiting        ││
│ │ Next: 14:30, 18:00, 09:15│ │        │            │ │14:30 18:00 09:15 ›││42 notes       › ││
│ └──────────────────────────┘ │        │            │ └───────────────────┘└─────────────────┘│
│ ┌ Storylines ──────────────┐ │        │            │ ┌ Storylines ───────┐┌ Fans & messages ┐│
│ │ 2 running · Suggest     ›│ │        │            │ │2 running · Suggest││Fans: Slurp (on) ││
│ └──────────────────────────┘ │        │            │ └───────────────────┘│DMs: followers  ›││
│ ┌ Memory ──────────────────┐ │        │            │                      └─────────────────┘│
│ │ 3 waiting · 42 notes    ›│ │        └────────────┴─────────────────────────────────────────┘
│ └──────────────────────────┘ │
└──────────────────────────────┘
```

The auto-posting switch is live on the tile (same mutation as the Posting tab). Every tile opens
its tab. The 10 "tab name" tiles are removed.

### 4.5 Creator modal → Memory tab (Continuity)

Order: Waiting for you → Life details (chips) → What they remember (search always visible; filters
folded) → Recent plans (human labels) → What happened → Signals (folded, read-only).

```
390 px
┌──────────────────────────────┐
│ Waiting for you (3)          │
│ ┌──────────────────────────┐ │
│ │ Likes rainy mornings     │ │
│ │ Interest · Public · 82 % │ │
│ │ [Remember it] [Discard]  │ │
│ └──────────────────────────┘ │
│ Life details      Extracted  │
│ People                       │
│ (Ana — sister ✕)(Tom ✕)[+  ] │
│ Places                       │
│ (Lisbon ✕)(the gym ✕)[+    ] │
│ … work, things, habits, jokes│
│ Heat  from [0][1][2][3]      │
│       to   [0][1][2][3]      │
│ [Save] [Read the card again] │
│ What they remember           │
│ [🔍 Search notes           ] │
│ ▸ Filters                  2 │  ← Type, Source, Scope, Status (selects),
│ ┌──────────────────────────┐ │    Confidence ──●── 50 %, From/To (type=date)
│ │ …fact cards…             │ │
│ └──────────────────────────┘ │
│ Recent plans                 │
│ Casual · Story · 14:30       │
│ Set · Photo set · yesterday  │
└──────────────────────────────┘
```

Desktop: same order; Life details chips in two columns (`lg:grid-cols-2`); filter selects in a
4-column grid inside the fold.

### 4.6 Remaining pages (no wireframe; same controls)

| Page                    | Change                                                                                       |
| ----------------------- | -------------------------------------------------------------------------------------------- |
| Audience                | `ChoiceRow` → `ChoiceSetting`; per-refresh caps → `RangeSetting`; StatusStrip.               |
| Messaging rules         | 10 delay inputs → 5 `RangePairField` rows inside `AdvancedGroup`; DM policy segmented.       |
| Ads                     | 4 enum selects → segmented; tone stays select.                                               |
| Coins and access        | percent/hour values → `RangeSetting`; prices stay `NumberSetting`.                           |
| Image generation        | size pairs → `RangePairField`; context/appearance modes segmented.                           |
| Writing & content level | explicit level cards moved to the top of the page.                                           |
| Stories & events hub    | move the 10 hardcoded English strings (`SlpBackstageContentPanel.tsx:13-38`) to locale keys. |
| Creator Profile tab     | Identity + Appearance card; fixed layout (§5.1).                                             |
| Creator Content rules   | `OverrideField` + level cards; guidance fields unchanged.                                    |
| Creator Fans & messages | fan mode as `OverrideField` + segmented; weights as `RangeSetting` (only while overridden).  |
| Creator Tools           | Improve, then danger block with Remove.                                                      |

## 5. Bugs to fix along the way

### 5.1 Identity tab squeezed into a narrow column, Save bar floating mid-right

Root cause: `features/creators/settings/SlpCreatorSettingsModal.tsx:417-418`. The Save/Discard bar
is rendered as the **third child** of the `sm:flex-row` container opened at line 214 (rail │ panel │
bar). From `sm` up the bar is `sm:static sm:shrink-0` with `sm:ps-56` (224 px padding), so it becomes
a non-shrinking column about 450 px wide to the right of the panel, and its own `items-center`
centres the buttons vertically ("floating mid-right"). The `flex-1` tab panel gets what is left:
896 px modal − 40 px padding − 208 px rail − gaps − ~450 px bar ≈ 160–240 px. At 768 px it is almost
zero. The artwork card (`SlpCreatorProfileEditor.tsx:225-249`) is only the visible victim.

Fix: render the bar inside the scrolling tab panel (line 377, the `role="tabpanel"` div) as its last
child with `sticky bottom-0 z-10 flex justify-end gap-2 border-t border-[var(--slurp-outline)]
bg-[var(--slurp-surface)] pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]`, and delete
`fixed inset-x-0 … sm:static sm:ps-56`. One element moves; the bar then spans exactly the panel
width at every breakpoint and sits in the thumb zone on phones.

Proof: static assertion in `tests/slurp2-creator-settings-safety.regression.ts` (the bar markup
appears after `role="tabpanel"` and no longer contains `sm:ps-56`), plus screenshots at 390/768/1440
with a dirty profile.

### 5.2 Continuity "Recent plans" shows raw ids (`multi_image_set`, `new_capture`, `story`)

Root cause: `features/creators/SlpContinuityPanel.tsx:272` prints `plan.delivery ?? ""` with no
translation. Those three values are `SLURP_CONTENT_DELIVERIES` (`shared/src/slp/slp-content-axes.ts:25`).
Labels already exist as `ui.slurp.composer.delivery.<value>` (used by `SlpComposerPurpose.tsx:80`).

Same defect family in the same panel and its sibling:

- `:163` proposal meta prints `proposal.candidate.factType` raw (the fact line at `:81` already uses
  `ui.slurp.continuity.factType.*`).
- `:205` filter options print `value.replaceAll("_", " ")` instead of the existing
  `factType` / `eventType` / `scope` / `status` keys.
- `SlpCreatorSignalsList.tsx:38` prints `audienceScope.replace(/_/gu, " ")` instead of
  `ui.slurp.continuity.scope.*`.

Fix (root cause, once): a small `continuityLabel(t, kind, value)` in `SlpContinuityPanel.tsx`
(`kind` = `delivery | intent | factType | eventType | scope | status | skipReason`), with a
humanized fallback, used at all four places; `SlpCreatorSignalsList` is in the same feature and can
import it.

Proof: a regression that, for every value of `SLURP_CONTENT_DELIVERIES`, fact types, event types,
scopes and statuses, asserts an `en.json` key exists; plus a source assertion that
`SlpContinuityPanel.tsx` no longer contains `plan.delivery ?? ""` or `replaceAll("_"`.

### 5.3 Continuity filters look heavy

Cause: seven always-visible full-width fields (`SlpContinuityPanel.tsx:188-239`) in a 4-column grid
that collapses to one column on phones, before any note is visible. Fix: keep search visible; move
Type/Source/Scope/Status, confidence and From/To into `AdvancedGroup` titled "Filters" with the count
of active filters; confidence becomes `RangeSetting` (0–100 %); From/To become `type="date"`.

### 5.4 Creator Storylines tab below touch-target and type size

`SlpArcConfigSection.tsx:33` uses `px-2 py-1 text-xs` selects and `text-[0.7rem]` labels (~28 px
targets). Fixed by the `OverrideField` rewrite (slice 3).

## 6. Build plan

One patch release per slice (next is **0.2.62**). Every slice: `npm run check`, the listed
regression(s), `heavy` build of **slurp2 only** with `MARINARA_ENGINE_ROOT`, then screenshots at
390/768/1440 on devbox-hosted in the states the slice touches (populated, empty, disabled reason,
long names). Ordered by value ÷ risk.

| #   | Version | Slice                                                                                                                                                 | Files touched                                                                                                                                                                                                   | Risk                        | Proof                                                                                                                                                                                                  |
| --- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | 0.2.62  | **Bug fixes** §5.1, §5.2                                                                                                                              | `SlpCreatorSettingsModal.tsx`, `SlpContinuityPanel.tsx`, `SlpCreatorSignalsList.tsx`, `locales/*.json`                                                                                                          | Low                         | creator-settings-safety assertion; new label-coverage regression; screenshots of Identity dirty state and Memory tab                                                                                   |
| 2   | 0.2.63  | `ChoiceSetting` + Storylines page                                                                                                                     | new `modules/settings/SlpSettingsInputs.tsx`, `SlpStorylinesPanel.tsx`, `SlpAudiencePanel.tsx` (drop `ChoiceRow`), `SlpBackstageKit.tsx` (delete `ChoiceRow`)                                                   | Low                         | new `tests/slurp2-settings-inputs.regression.ts`: ChoiceSetting renders `fieldset` + `type="radio"`; Storylines has no `<select`; backstage-anchors still green                                        |
| 3   | 0.2.64  | `OverrideField` + creator Storylines rewrite                                                                                                          | `SlpSettingsInputs.tsx`, `SlpArcConfigSection.tsx`, locales                                                                                                                                                     | Medium (per-Creator writes) | update `slurp2-arc-config.regression.ts`: no `Global (` option; own-value off deletes the key; own-value on writes the global value                                                                    |
| 4   | 0.2.65  | Memory tab polish: filters fold (§5.3), `ChipListInput`, heat segmented                                                                               | `SlpSettingsInputs.tsx`, `SlpContinuityPanel.tsx`, `SlpCanonAnchorsEditor.tsx`                                                                                                                                  | Low                         | extend `slurp2-canon-anchor-editor.regression.ts`: chips → `join("\n")` → `slpCanonAnchorsFromDraft` round-trips "Name — relation"                                                                     |
| 5   | 0.2.66  | Remaining enum selects → `ChoiceSetting`; merge `FineTune` into `AdvancedGroup`; remove pace wizard                                                   | `SlpPublishingPanel.tsx`, `SlpImagesPanel.tsx`, `SlpAdsPanel.tsx`, `SlpMessagingPanel.tsx`, `SlpWalletPanel.tsx`, `SlpSimulationPanel.tsx`, `SlpSettingsKit.tsx`, `SlpSettingsControls.tsx`                     | Medium (many pages)         | regression: listed enum `settingKey`s are not inside a `<select>`; `FineTune` no longer exported; anchors green                                                                                        |
| 6   | 0.2.67  | Creator tabs 14 → 8 with alias map; split `SlpCreatorSettingsSections.tsx` (784 lines)                                                                | `slp-creator-settings-sections.ts`, `slp-creator-settings-store.ts`, `slp-creator-settings-contract.ts`, `SlpCreatorSettingsModal.tsx`, new `SlpCreatorPostingTab.tsx`, `SlpCreatorFansTab.tsx`, moved sections | Medium (deep links)         | 7 tabs (Wardrobe inside Profile); update creator-settings-safety (group union, labels); new assertion that every old tab id resolves through `SLP_LEGACY_CREATOR_TAB`; architecture test for file size |
| 7   | 0.2.68  | Creator Overview dashboard; open on Overview                                                                                                          | `SlpCreatorSettingsSections` (split file), `slp-projects-contract.ts` (export `useSlurpArcs`), store default                                                                                                    | Low                         | regression: every tile target is a registered tab; screenshots empty/new Creator vs busy Creator                                                                                                       |
| 8   | 0.2.69  | Schedule agenda replaces per-slot datetime + Save                                                                                                     | `SlpCreatorPublishingSection.tsx`, new `slp-schedule-agenda.ts` (pure helpers), `SlpBackstageKit.tsx` (delete `ScheduleSlotEditor`)                                                                             | Medium (time zones)         | regression on `groupSlotsByDay(slots, now)` and `withLocalTime(iso, "HH:MM")` incl. midnight and DST dates; past time rejected                                                                         |
| 9   | 0.2.70  | Backstage sections split (§2.1: Models & connections, World, Fans & money) + legacy destination map + `SectionSheet` phone nav                        | `slp-backstage-target.ts`, `slp-backstage-registry.ts`, `slp-backstage-placement.ts`, `SlpBackstageSidebar.tsx`, new `modules/settings/SlpSectionSheet.tsx`, `SlpCreatorSettingsModal.tsx`                      | Low                         | `slurp2-navigation.regression.ts` / `slurp2-backstage.regression.ts` updated for order; legacy destinations unchanged; phone screenshot                                                                |
| 10  | 0.2.71  | Numbers: `RangeSetting`, `stepper`, `RangePairField`, `useQueuedSave`                                                                                 | `SlpSettingsControls.tsx`, `SlpSettingsInputs.tsx`, Messaging, Wallet, Images, Storylines advanced, creator fan weights                                                                                         | Medium (save queue)         | regression on `useQueuedSave` ordering (stale save cannot win) via the existing NumberSetting cases; keyboard check of range                                                                           |
| 11  | 0.2.72  | `StatusStrip` on Storylines, Publishing, Images, Audience, Messaging and merged creator tabs; content level to top of Prompts; hub strings to locales | `SlpSettingsInputs.tsx`, those panels, `SlpBackstageContentPanel.tsx`, locales                                                                                                                                  | Low                         | locale-keys regression; strip chip focuses its anchor (browser suite `test:browser:slurp2`)                                                                                                            |

Notes:

- Slices 2–5 can ship before the tab regroup; merged tabs in slice 6 only compose finished sections.
- Every slice that adds strings adds de/ko/pl keys with English values (existing repo practice) so
  `slurp2-locale-keys.regression.ts` stays green.
- Final pass after slice 11: `web-design-guidelines` audit on changed files.

## 7. Decisions (2026-09-25)

1. **Backstage sections:** split as in §2.1 — new "Models & connections" section directly below
   Overview; "World" keeps only world pages (hub, Events, Calendar); new "Fans & money" section;
   "Stories" keeps Storylines, Storyline types, Packs. Order by frequency of use.
2. **Wardrobe:** goes into Profile as a "Looks" block (7 creator tabs). Mind the Profile
   unsaved-changes guard: Wardrobe saves on its own and must not mark the form dirty.
3. **Page summary:** chip strip.
4. **Pace wizard:** remove.
5. **Moving a scheduled post:** time-only edit plus "Another day" link (agent default, not asked).
