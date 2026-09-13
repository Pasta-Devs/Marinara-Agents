# Slurp Arcs v2 — Concept

Status: concept, nothing built. Follows `SLURP-ARCS-PLAN.md` (v1, shipped).

## What v1 has, and what is wrong with it

- Arc kinds are a hardcoded enum (`SLURP_ARC_KINDS`) with hardcoded templates (`SLURP_ARC_TEMPLATES`).
  The player cannot add, rename, edit, or delete a kind. Only `custom` is free text, per arc.
- Auto arcs (`arcAutoMode`, `arcCooldownWeeks`, `arcAllowedKinds`, `arcPace`) are global. Every
  Creator gets the same rules, the same pool, and (because the roll is per week) often at the same time.
- Tags are a hardcoded list (`SLURP_DISCOVERY_TAGS`). Gender and tags are inferred by the stage-profile
  draft and may stay `null` / empty. Nothing asks the player to confirm them.

## Goal

1. An **Arc Library** in Settings: the player adds, edits, and removes arc types (name + description,
   optional chapters). Shipped kinds become editable seed entries.
2. Slurp still **generates arcs on its own**, from the library or freely invented by the model.
3. **Per-Creator arc config** overrides the global one, so Creators do not all run arcs at once.
4. **Tags are a setting**: an editable tag list. Creator creation **requires** gender and tags.

## 1. Arc Library (global setting)

New setting `arcLibrary: SlurpArcType[]`, seeded from today's templates on first read.

```ts
type SlurpArcType = {
  id: string;             // stable; seeds use the old kind ("moving", "trip", …)
  name: string;           // "Moving house"            max 80
  description: string;    // direction for the model    max 2000
  chapters: { label: string; minDays: number; maxDays: number }[]; // optional, max 12
  tags: string[];         // optional: only offered to Creators with one of these tags; empty = all
  enabled: boolean;       // off = never auto-picked; still manual-usable
  builtin: boolean;       // seed entry; "Reset to default" available
};
```

- Settings → Arcs tab gets a list: add, edit (name, description, chapters, tags), enable toggle,
  delete, reset built-in. Delete of a built-in hides it (`enabled: false` + hidden), so a reset can restore it.
- `arcAllowedKinds` is removed; `enabled` on each type replaces it. Migration: types not in the old
  `arcAllowedKinds` start with `enabled: false`.
- A running arc **copies** its type at start (title, direction, chapters, `typeId`). Editing or
  deleting a type later never breaks or rewrites a running arc. `kind` on `SlurpProject` becomes
  `typeId: string | null` (old kind value maps 1:1 to seed id).
- No chapters on a type → open-ended arc; the model is told the description and the arc ends after
  a duration (`defaultDays` on the arc, player-editable) instead of after a last chapter.

## 2. Generated arcs

`arcAutoMode` keeps `off | suggest | auto`. New setting `arcSource`:

| Value | Behaviour |
|---|---|
| `library` | pick an enabled library type (today's behaviour) |
| `generated` | ask the model to invent an arc for this Creator |
| `mixed` (default) | library if a match exists, otherwise generated, ~1 in 3 generated |

Generated arc:
- One small structured-output call (reuse `slurp-response-format.ts` pattern) with the Creator's
  stage personality, tags, recent posts summary, and **the library names as examples and a list of
  arcs this Creator already had** (to avoid repeats).
- Returns `{ title, direction, chapters[{label,minDays,maxDays}] }`, validated with the same
  `readSlurpProject` clamps.
- Stored as an arc with `typeId: null`, `origin: "generated"`. In `suggest` mode the panel shows
  Accept / Edit / Dismiss. "Save to library" button turns a good generated arc into a library type.
- Failure of the call = no arc this tick. No retry loop, no fallback text.

## 3. Per-Creator arc config

Stored per Creator next to projects: `slurp2.creator.<id>.arcConfig`. Every field is optional;
missing = use the global setting.

```ts
type SlurpCreatorArcConfig = {
  autoMode?: "off" | "suggest" | "auto";
  source?: "library" | "generated" | "mixed";
  cooldownWeeks?: number;       // 1–8
  pace?: "slow" | "normal" | "fast";
  allowedTypeIds?: string[];    // subset of library; missing = all enabled matching tags
  maxActive?: number;           // 1–3
};
```

- Creator → Arcs panel gets a "Arc settings" section: each field shows "Global (value)" or an override.
  One "Reset to global" button.
- **Staggering** (so Creators do not all start at the same time):
  - Roll seed becomes `creatorId + day` (not week), and the per-Creator chance is
    `1 / (cooldownWeeks * 7)` per eligible day → spread across the cooldown window.
  - New global setting `arcMaxConcurrentAuto` (default 2): the world tick does not start an auto
    arc when that many Creators already have an auto arc active or suggested. Manual arcs do not count.
  - First eligibility for a new Creator is `createdAt + cooldown`, so a batch of new Creators does
    not roll at once.

## 4. Tags as a setting, and gender + tags at creation

### Tag list setting
- New setting `discoveryTags: { tag: string; group: string }[]`, seeded from `SLURP_DISCOVERY_TAGS`
  with today's groups (the Discover toolbar already groups them).
- Settings → new "Tags" section: add, rename, delete, move between groups.
- `SLURP_DISCOVERY_TAGS` stays only as the seed. Everything that reads it switches to the setting:
  `normalizeSlurpDiscoveryTags(curatedOnly)`, the draft prompt (`slurp-stage-profile-draft.service.ts:107`),
  the response JSON schema enum (`slurp-response-format.ts:140`), the Discover filter.
- Rename a tag → rewrite it on every Creator profile (one storage pass). Delete a tag → confirm
  dialog with "Used by N Creators, M arc types", then remove it from Creators and from arc types. Free-text tags on Creators that are not in the list stay allowed
  (current behaviour) but are shown as "custom".

### Creation flow
- The stage-profile draft still pre-fills gender and tags.
- The create step shows gender (male / female / other) and a tag picker from the setting.
- **Create is disabled until gender is set and at least 3 tags are chosen.** Server enforces it too:
  the create route rejects `gender: null` or empty tags (400), so an older client cannot skip it.
- Existing Creators with no gender or tags: a badge "Profile incomplete" in the Creator list; not blocking.
- Tags feed arcs: library types with `tags` are only offered to Creators that share a tag; generated
  arcs get the tags in the prompt.

## 5. Making arcs fun

Arcs are mainly something to watch and flavour. They run on their own; the player steers only if
they want to.

### Choices (branching chapters)
- A chapter may have a `choice`: a question and 2–4 options, each option pointing to the next
  chapter (or a short branch of chapters). Library types can define them; generated arcs may include
  one per arc.
- **Director mode off (default):** the Creator posts the choice as a **fan poll**. The poll runs
  `arcPollHours` (default 24). The winning option sets the next chapter. No votes → the model picks.
- **Director mode on:** the player also sees the choice in the Creator's Arcs panel and can pick
  before the poll ends. Player pick wins over the poll.

### Fans react and vote
- Chapter changes and arc ends create fan events (existing `recordCreatorEvent` path): comments,
  DMs from high-rapport fans, and the polls above.
- Poll results and top fan reactions are saved on the arc and shown on the timeline.

### Arc timeline card
- On the Creator profile: title, tone chip, chapter track (done / current / next or "?" for an open
  choice), key posts per chapter, poll results, stat changes, and a finish badge.
- Finished arcs stay as a history list ("Arcs: Moving house ✓, Trip to Lisbon ✓").

### Crossover arcs
- An arc may have 2–3 Creators (`creatorIds[]`), one shared story, one timeline shown on all profiles.
- Auto: the world tick may start a crossover for Creators that share ≥ 1 tag or have an existing
  relationship. Counts against every participant's `maxActive` and against `arcMaxConcurrentAuto`.
- Manual: "Start crossover" in the Arcs panel with a Creator picker.
- Each participant's posts and DMs get the arc line from their own point of view.

### Tone
- Arc types and generated arcs carry a free `tone` (cozy, dramatic, funny, spicy, dark, …).
  No tone limits: the model picks freely. The earlier `breakup`-off-by-default rule is dropped.

### What an arc changes
- **Mood and DMs:** stance line per chapter (exists), plus optional per-chapter mood modifier.
- **Images:** the current chapter line is added to the image prompt for arc posts.
- **Profile changes:** a chapter may propose a new bio, location, or banner. These wait for the
  player's approval (notice in the Creator panel: Apply / Reject). Changes can revert at arc end.
- **Stats effects:** chapters may carry `effects` on follower growth, earnings, fan loyalty.
  Setting `arcStatEffects`: `off | small (default, max ±10%) | big (max ±50%)`. Effects apply while
  the chapter runs and show on the timeline.

### Director mode
- Global toggle `arcDirectorMode` in Settings → Arcs, **default off**.
- On: the Arcs panel shows pause, skip chapter, go back, edit current chapter, add twist (written or
  random), end early, and pick choice options.
- Off: arcs run by themselves; the panel is read-only apart from delete.

## Settings summary

Global (Settings → Arcs): `projectRate`, `arcPace`, `arcAffectsMood`, `arcFanReactions`,
`arcAutoMode`, `arcSource` *(new)*, `arcCooldownWeeks`, `arcMaxConcurrentAuto` *(new)*,
`arcLibrary` *(new, replaces `arcAllowedKinds`)*, `arcDirectorMode` *(new, default off)*,
`arcPollHours` *(new, 24)*, `arcStatEffects` *(new, small)*, `arcCrossovers` *(new, on)*.

Global (Settings → Tags): `discoveryTags` *(new)*.

Per Creator: `arcConfig` *(new)*, `gender` + `tags` *(required on create)*.

## Phases (one PR each, patch bump each)

1. **Tags setting + required gender/tags on create.** Smallest, independent, user-visible.
2. **Arc Library.** Settings list, migration from enum + `arcAllowedKinds`, arcs copy type at start.
3. **Per-Creator arc config + staggering.** Override storage, panel section, day seed, concurrency cap.
4. **Generated arcs + tone.** `arcSource`, structured call, Accept/Edit/Dismiss, Save to library.
5. **Timeline card + Director mode.** Profile timeline, history list, director controls behind toggle.
6. **Choices + fan polls.** Branching chapters, poll posts, poll resolution, player pick in Director mode.
7. **Reach.** Image prompt line, profile change proposals with approval, stat effects setting.
8. **Crossover arcs.** Multi-Creator arcs, auto pairing by tags/relationships, manual start.

Checks per phase: one regression test each — tag rename/delete propagation; old `kind` →
`typeId` migration; override resolution + concurrency cap; generated-arc output clamping;
director actions on chapter state; poll resolution (winner, tie, no votes); stat effect clamp per
`arcStatEffects`; crossover limits across participants.

## Decisions (2026-09-13)

- Arcs run automatically; `arcDirectorMode` toggle, default off.
- Choices: fan poll decides, model picks with no votes; Director mode lets the player pick.
- Crossovers: auto by shared tags or relationships, plus manual start.
- Tone: anything goes, no tone limits.
- Reach: mood and DMs, images, profile changes (need approval), stats effects (small by default).
- Gender list stays fixed: male / female / other.
- Creation needs gender and at least 3 tags.
- Deleting a tag in use shows a confirm dialog with counts.

## Open questions

- Existing Creators with fewer than 3 tags: badge only, or ask on next edit? Default: badge only.
- Do fan polls cost anything or show in the feed like normal posts? Default: normal posts.
