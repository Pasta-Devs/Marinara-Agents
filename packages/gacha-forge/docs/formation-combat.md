# Formation combat

Formation is an optional Gacha Forge combat mode alongside Classic. It is based on the maintainer's Formation Combat proposal and reuses existing elements, progression, enemies, rewards, battle dialogue and presentation.

## Rules and player flow

- Choose Classic or Formation when creating a playthrough. Classic remains the default.
- Formation deploys one to four characters, with one to three in the Front Row and the rest in the Back Row. Supports generate typed shared energy; ready frontline fighters each choose one action. The energy bank carries between turns and holds at most twelve points.
- Provide free Attack and Guard, character Standard Ability and Ultimate, and action-cost repositioning. Enforce proposal targeting, movement, elemental payment, defeat, status and bounded trigger rules in one shared simulator. Server rewards replay recorded choices against frozen snapshots.
- Generated kits may express bounded distinctive mechanics, including solo frontline bonuses, tokens and row changes. Creative bosses use validated declarative objectives such as elemental barriers and ordered targets, with readable rules and available counterplay. Preserve enemies talking during combat.
- Existing runs can request a confirmed mode switch in Story Continuity. Persist resumable per-unit conversion jobs with bounded concurrent generation. Preserve identity, classic kits, level, equipment, inventory and story. Activate Formation only after all required kits are ready; failures remain visible and retryable. Oversized saved teams require an explicit four-character selection.

## Voice and presentation

Show the acting character's portrait with existing elemental effects when using an Ultimate. Preserve reduced motion, readable status, mobile controls and saved themes.

Add an opt-in Combat voice lines control under World Sources Audio. Only voiced characters receive a fixed saved set of four lines: death, enemy defeat and two Ultimate variants. Generate through current voice/provider contracts, persist the resulting audio in package storage, and reuse it on later battles and reloads. No automatic regeneration or unvoiced fallback generation.

## Validation target

Prove deterministic client/server replay, valid payments/turns/repositioning/defeat, status/trigger bounds, legacy fights, every battle/reward path, migration failure/retry/restart/concurrency, fixed audio cache reuse, ultimate effects and enemy speech. Run source/package, actual SDK/HTTP, browser and lifecycle checks. No physical-device or paid-provider claim without that proof.
