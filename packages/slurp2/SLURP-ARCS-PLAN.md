# Slurp Arcs Plan

Status: proposal. Nothing here is built yet.

## Problem

Every Creator ends up "moving house". There is no story system doing this. It is an accident
of two prompt rules working together:

1. **The rotation plants it.** `slurp-post-variation.ts` `PLACES[5]` is
   `"somewhere in the middle of a small, ordinary change to their space"`. Place rotates on
   `(offset + step) % 6`, so every Creator lands on it once every six posts. The model reads it as
   boxes, a new flat, a move. `"out of the house entirely"` and `"somewhere they had to travel to
   get to"` lean the same way.
2. **Continuity keeps it.** `slurp-prompt.ts:35` tells the model to use recent activity for
   "facts, relationships, and continuity". Once one post says "moving", later posts treat it as an
   established fact and continue it.

Result: an uncontrolled, invisible arc that every Creator gets, that the player cannot see, pause,
or stop.

Meanwhile the real thread feature, **Projects** (`slurp-project.ts`), is manual only, advances one
chapter per published post (a five-chapter move finishes in two days), and touches nothing but the
post prompt.

Not affected: `slurp-audience-arc.ts` is about fans, not Creators, and stays as it is.

Unverified: the diagnosis comes from reading code. Phase 0 confirms it on real data.

## Goal

A Creator has a life event only when an arc says so. Arcs are visible, configurable, paced in days,
and consistent across posts, DMs, and mood.

## Phase 0 — Confirm the cause

- On the dev Engine, pull recent auto-posts for 2–3 affected Creators with their sequence numbers.
- Check that the first "moving" post lines up with the `PLACES[5]` slot for that Creator, and that
  later posts carry it through history.
- If it does not line up, stop and re-diagnose before Phase 1.

## Phase 1 — Remove the accidental arc (small PR, ship first)

Files: `server/src/services/slurp/slurp-post-variation.ts`, `slurp-prompt.ts` if needed.

- Replace `PLACES[5]` with an angle that does not imply a life event, e.g.
  `"in their usual place, with something small out of order"`.
- Soften `"somewhere they had to travel to get to"` to `"somewhere a short trip from home"`.
- Add one line to `slurpPostVariationInstruction`:
  `"This angle is for this post only. Do not turn it into an ongoing change in their life."`
- Keep `PLACES.length` at 6 so the rotation and existing Creators' offsets do not shift.

Check: one regression test asserting no variation instruction contains `change to their space`
and that the "this post only" line is present.

Existing Creators already stuck in a move will drift out as the history window rolls past those
posts. No data cleanup.

## Phase 2 — Arcs settings tab

Files: `client/.../slurp-navigation.types.ts`, `SlurpSettings.tsx`, `locales/en.json`,
`server/.../storage/slurp.storage.ts` (settings schema).

- Add `"arcs"` to `SLURP_SETTINGS_SECTIONS` and `ui.slurp.settings.tabs.arcs`.
- Move `projectRate` from the Publishing tab to Arcs. Same stored key, so no migration.
- New settings, each with a default in the settings schema:

| Key | Values | Default |
|---|---|---|
| `arcsEnabled` | boolean | `true` |
| `projectRate` (label "Arc share of posts") | off / rare / regular / often | `regular` |
| `arcAutoMode` | off / suggest / auto | `off` |
| `arcCooldownWeeks` | 1–8 | `3` |
| `arcPace` | slow / normal / fast | `normal` |
| `arcAffectsMood` | boolean | `true` |
| `arcFanReactions` | boolean | `true` |
| `arcAllowedKinds` | kind[] | all except `breakup` |

- UI copy: "Projects" becomes "Arcs" in the Creator panel. Internal names stay `project` for now.

Settings that later phases read are added in the phase that reads them, not here, so no setting
ships without an effect. Phase 2 ships `arcsEnabled` and the moved `projectRate` only.

## Phase 3 — Time-paced arcs with kinds and templates

Files: `slurp-project.ts`, `slurp.storage.ts` (`advanceProject`), `SlurpProjectsPanel.tsx`.

Extend the stored shape (JSON under `slurp2.creator.<id>.projects`, no DB migration):

```ts
type SlurpArcPhase = { label: string; minDays: number; maxDays: number; beat: string };

SlurpProject += {
  kind: "moving" | "new_job" | "trip" | "fitness" | "renovation" | "breakup" | "custom";
  phases: SlurpArcPhase[];      // replaces chapters; old chapters read as phases without limits
  phaseStartedAt: string;
  intensity: "background" | "focus";
}
```

- `readSlurpProject` maps old records: `chapters[i]` → `{ label, minDays: 0, maxDays: 0, beat: label }`,
  `kind: "custom"`. Zero limits keep today's "advance per post" behaviour for old arcs.
- Advance rule: move to the next phase after a published post when
  `daysInPhase >= minDays * pace`, or on any tick when `daysInPhase >= maxDays * pace`.
  Advancing stays post-publication, so a failed generation never skips a phase.
- Templates: a const map of kind → phases in `slurp-project.ts`. Example, moving:
  deciding (2–5d) → packing (3–6d) → moving day (1–1d) → empty flat (2–4d) → settling in (4–10d).
- Only one `focus` arc at a time. Background arcs get half the project slots.
- Panel: kind picker fills phases from the template, still editable. Custom keeps the text form.

Check: regression test for the advance rule (min/max days, pace, old-record mapping).

## Phase 4 — Arcs reach DMs, mood, and fans

Files: `slurp-stance.ts`, `slurp-day-vibe.ts` or `slurp-creator-state.ts` modifiers,
`slurp-world.operation.ts`.

- Stance: add an `arc` layer next to `audienceArc`, one line from the focus arc's current phase,
  e.g. "You are in the middle of moving; the flat is all boxes." Gated by `arcAffectsMood`.
- Mood: optional per-phase modifier (e.g. moving day → `tired`) using the existing
  `SLURP_MODIFIERS` mechanism, no new mood system.
- Fans: on phase change call `recordCreatorEvent(account.id, "arc_phase", …)`, the same path audience
  arcs use. High-rapport fans may comment or DM about it. Gated by `arcFanReactions`.
- Completion: a finished arc records an `arc_complete` event and shows as a milestone.

Adds settings: `arcAffectsMood`, `arcFanReactions`.

## Phase 5 — Automatic and suggested arcs

Files: `slurp-world.operation.ts`, `slurp-project.ts`, `SlurpProjectsPanel.tsx`.

- In the world tick, per Creator with no active arc and cooldown elapsed, pick a kind from
  `arcAllowedKinds` with a seed of creator id + ISO week. Deterministic, like audience arcs.
- `suggest`: store it with status `suggested`; the panel shows Accept / Dismiss. Dismiss restarts
  the cooldown.
- `auto`: store it as `active`.
- Per-Creator override of `arcAutoMode` in the Creator panel.

Adds settings: `arcAutoMode`, `arcCooldownWeeks`, `arcAllowedKinds`, `arcPace` (if not added in 3).

## Release

- Each phase is one PR. Phase 1 can ship alone.
- Patch version bump only, in `scripts/build-feature-packages.mjs`; rebuild artifact and catalog.
- CHANGELOG and `slurp2-release.ts` notes per release.
- Slurp has pre-existing red regressions on main; re-derive the baseline before judging a failure.

## Open questions

- Should Phase 1 also cap how long a single topic may persist in post history, or is removing the
  trigger enough? Default: removing the trigger; revisit if Phase 0 shows other sources.
- Rename `project` → `arc` internally? Default: no, UI copy only.
- Is `breakup` a kind at all, given adult Creator content? Default: shipped but off.
