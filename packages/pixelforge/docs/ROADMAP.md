# Pixelforge Roadmap

**Revised 2026-08-21.** This replaces the flat 19-item discovery-order list. It folds in the design brief of the same date (missing pillars, new features, and per-item companions) and three maintainer rulings, recorded below so they are never re-litigated by accident. The old numbers survive as aliases — see the index — but the flat list itself is retired.

**Updated 2026-08-22.** A progress pass, not a re-cut: the 0.10 shipped-history row now records what has landed on `feat/pixelforge-room-zoning` (the street grid and the population mint, size-follows-program interiors, the hearth) and what remains; W3, L1, L3, E2, E6 and W5 carry entry-level notes where the work moved them; Open Questions gains two. The structure, the groups and the three rulings are untouched.

**Updated 2026-08-24.** Three items added, all from a maintainer playtest of the 0.11 build: **S6** — the package's parallel setup dialog retires into Game Mode's own; **L6** — presence follows the narration, so the sprite goes where the story says it went; **W7** — venue variety, district naming and being able to *find* the inn. Nothing else moved: the groups, the rulings and the sequencing are as they were.

**Updated 2026-08-24, second playtest.** Three more items and one amendment, all from the same day's second session: **S7** — the engine generates HUD widgets this surface never draws, and one of them is a second purse; **P7** — the GM narrates transactions that no ledger ever sees; **E7** — generic NPC dialogue comes off the narration channel and becomes an `Ask` tree. **L6 is amended** with the maintainer's refined ruling on when the GM may move the player at all, which turns location into the pacing mechanism rather than a thing the narrator routes around. S7, P7 and E7 all describe the same seam from three sides — the engine and the package each running half a game — so read them together.

**Updated 2026-08-25, the 0.12 pass.** A progress pass and a growth pass together. Progress: 0.11 gets the shipped-history row it never got, and the release bullets are corrected against what the two releases actually contain — **0.11 did not ship S2 or L2**, and 0.12 is S4 + P3's fishing vertical + P5 + the bridge treatment. S2, S4, S7, L2, P1, P3, P5, P7, the sequencing list and the second pillar carry entry-level notes where the work moved them, and open questions 5 and 7 record the answers 0.12 gave them. Growth: seven items enter, all of them maintainer rulings taken during the 0.12 design — **L7** autonomous world change and factions; **P8** ruleset-pluggable character sheets; **P9** boons and enchanted equipment; **P10** the sleep-deprivation debuff; **P11** the smart device and online shopping; **W8** the swamp biome; **W9** a "modern" theme. L2 is amended with the weather→schedule bias the same ruling round settled. The groups, the three rulings and the sequencing shape are untouched.

**How this document is organized, and why.** Items are grouped by **which layer of the package they extend**, not by when anyone thought of them. Discovery order tells you when an idea arrived; a contributor deciding what to build next needs to know what a thing touches, what it depends on, and what it unlocks. The five groups mirror the package's real seams: **S** — substrate (channels and data everything else hangs off), **L** — the living settlement (the world moving without the player), **P** — the player's stake (ownership, progression, and the things the player does), **W** — the wider world (exploration and settlement variety), **E** — the cast (people as content). After the groups: sequencing, the will-not-build list, and open questions.

---

## Shipped history

A reader should see the arc: each release made the world *more specific* without ever letting the model place a tile.

| Version | Shipped |
|---|---|
| **0.4** | The theme layer (cozy-village, sci-fi-colony) and the LLM-authored sealed brief: the model decides what exists, the algorithm decides where every tile goes. |
| **0.6** | Package clock, dwellings, settlement layout. |
| **0.7** | NPC daypart schedules — the kind×standing table resolved at dawn/day/dusk/night; 5 real seconds per game minute. *(Old item 7 — shipped.)* |
| **0.8** | Interiors, beds and bunks, rooms as partitions, the live-work housing model, floors (upper storeys, cellars, bell tower), tall buildings, roof-transparency bubble. |
| **0.9** | Cast bindings: `workplace`, the worker schedule tier, one head per building, household ids as an id space, and the `city` scale at 96×72. |
| **0.10** | **It grew, and it landed in two halves.** **Interiors (the original scope):** rooms vs **areas** — open floor with a purpose, recorded rather than walled (the vacated dining band and the kitchen corner are areas). Note honestly: the recorded 0.9 decision was a *walled*, prosperity-gated kitchen; 0.10 shipped areas instead because a walled kitchen needs a second band the cottage cannot spare — an interim override awaiting the maintainer's yes/no, not a settled reversal, with the walls waiting on the taller shells the sizer now builds; **size follows program** — a house is as big as its household (width and a second room band from the sleep plan, capped at **three bedrooms** so the bunk/density rule stays live; a merged tenement keeps the plain shell), a trade is sized by its trade (a farm gets frontage, a smith gets floor, a duty station is a hut with a door; roomy footprints start at village, because an outpost cannot spare the ground); a **`hearth` in every dwelling**, with the dawn and dusk schedule tiers anchored to it (see L3); and a harness guard that **every placed tile has art**, added after a hearth with no painter passed the entire suite. *Interiors still open:* the full wings-and-spine partitioner, the rest of the room vocabulary — `bedroom` rooms plus `dining`/`kitchen`/`corridor` areas (and the old `dormitory()` fallback) exist; bath, workroom, storage, shopfloor, taproom, nave, council, quarters, guestroom, unit, reception, privy, stable, washhouse, study, loft and porch do not — and per-trade workroom placement. **Settlement scale (grew into this release):** a street-grid lot allocator replaces the two hardcoded rows (runs centred on their span, lots claimed nearest-the-crossroad first); maps raised to 28×20 / 48×28 / 60×40 / 76×52 / **104×72**, seating 4 / 8 / 16 / 36 / **80 lots**; **population now derives from the sealed axes** — households per rank 3/6/12/24/45, leaned by prosperity, clamped to the lots that actually exist — and the compiler **mints residents** (names, kinds, schedules, beds) to fill the town, so the cast is no longer the whole population (measured: village ~25, town ~60, city ~120); `backgroundPopulation` gains its first consumer with the §9 reservation honoured — it moves a settlement *within* its rank's band and can never set the band; day anchors spread (a minted resident holds the street outside their own door; a quarter of the town keeps the square); per-rank caps on how many places and features a rank may seal, over-asks recorded in `repairs`; round-robin household distribution (the apartment primitive — an address can hold more than one household); leftover lots become kitchen gardens (loose ranks) or public **parks** (dense ranks — every third leftover lot, never more than six). *(Old item 13 — its "deferred decoration" description is retired; this is a release, not a nice-to-have. Its runtime companion is L3.)* |
| **0.11** | **The save learns to hold a person.** **S5 — the player state block:** one namespaced, versioned `player` key inside the snapshot for everything that cannot be recomputed — pouch and purse, skills and equipped tools, the relationship ledger, quest state, the day-ledger buffer, discovery state, the home anchor — with its own version, migration on read, and a newer build's unknown keys re-emitted rather than deleted. Beside it: world-identity **stamps** (seed, brief hash, mint stamp) that sever a save whose world changed under it, a four-slot **quarantine bag** in its own metadata key that holds what was severed until the world comes home, and one **GET decision ladder** replacing four sites that each guessed differently at "is this row mine, and is it newer than what I hold?". Full specification in `docs/player-state.md`. **S3 — the pouch:** an item vocabulary, per-theme skins and currency (a colony pays in credits and issues berth chits), fixed price lists, and a starting purse paid once on the first sealed world. **P1's field, by the player-driven path:** there is no automatic home, so the bed is a **berth rented at the settlement's inn** — the one transaction 0.11 ships, and the trigger P5 needed. **The loading gate:** a chat configured to generate no longer plays a throwaway world while it waits, and no failure ever seals a default on the player's behalf — a retry screen says which kind of failure it was. Down payments on three later items: S6's generate-or-decline checkbox, E7's "Skip story & talk?" guard, and W7's bug half (the venue post-condition now runs against the sealed cast, not the model's draft). **Not in it, despite the old suggestion bullet: S2 and L2.** |

---

## Rulings absorbed (2026-08-21) — do not re-litigate

**Ruling 1 — the structured quest log is IN.** The earlier design brief argued the transcript is the journal and the GM makes a quest engine redundant. **Overruled**, and the reasoning matters: Pixelforge is to be *both* an RPG and an AI RP experience, and some players will want to grind generic quests for money, experience, and rapport **while being lean with AI calls**. The old analysis missed that a quest system is also a way to *play without spending GM calls* — a real need this package had no answer to. Design constraints from the ruling: the GM is kept aware at a **wrap-up boundary** (sleep summarizes the day to the narrator), not per-step; questing skews fantasy/sci-fi and a slice-of-life player may never touch it, **and it must never be forced** — opt-in or naturally ignorable, never a spine. This ruling adds a sixth pillar (below) and is embodied in items P4, P5, S4, and the revised E1. What it made *more* valuable: the pouch (money), the relationship ledger (rapport), the offline dialogue pack (same generation problem), the player home (the sleep boundary needs a bed), and the quest board. What it made redundant: nothing — only the refusal itself.

**Ruling 2 — no reflex minigames for fishing; RNG with inputs instead.** The refusal of timing-bar minigames stands, but the replacement is specified: **RNG-based, with skill level and rod/bait quality affecting what can be caught and the success rate.** A probability table with player-side inputs, not a bare progress bar. This quietly introduces two things that existed nowhere in the package — **equipment quality** and **improvable skill levels** — which are deliberately split out as their own substrate item (S4) because every time-passing action, the quest layer, and the economy all consume them.

**Ruling 3 — everything in the 2026-08-21 brief enters the roadmap.** Nothing dropped for being speculative.

---

## The pillars

The gaps the roadmap exists to close, in order of how much they matter for *this* game. Every item below carries a pillar tag.

1. **Consequence** — the world never registers the story. The GM narrates a fire; the barn stands forever. The narration→world direction does not exist (its one beachhead: the `_hold` seam in `resolveSchedules()`).
2. **The second verb** — Talk was the only content verb and the entire map was scenery. **0.12 opened this a crack and no further, and the distinction matters:** fishing is a real second content verb with a real target, but it reaches that target through a proximity-gated button of its own rather than through a general Inspect/Use, so the map is scenery everywhere there is no water. What did fall out of it is the schema's reserved feature-name labels (§9), which have had a consumer since 0.12 — the Fish button and the ledger line both name the water they are about. S2 is still the item that turns the rest of the map into content.
3. **Things** — no items, money, or ownership. Connective tissue for every action system.
4. **The unknown** — everything exists at boot; travel is a dropdown. Exploration needs destinations that *don't exist yet*.
5. **Progression** — social progression (rapport, reputation) first; and — revised per Ruling 1 — **light mechanical progression** (skills, tools, money) as the lean-play track. The earlier claim that XP doesn't matter here was half wrong: it doesn't matter *as a substitute for the narrator*, but it does matter as a way to play beside the narrator.
6. **Call economy** *(new, named by Ruling 1)* — content that plays without spending LLM calls: canned dialogue, offline quests, deterministic weather. The header-and-injection discipline was already serving this pillar unnamed.

**Secondary tags.** Items below also carry lighter tags that are not pillars — they describe a quality an item serves rather than a gap it closes. The full set, so filtering stays consistent: **soft stakes** (closed doors, missed people, weather — the grade of risk the package's own systems trade in; combat risk exists too, it just lives with the engine, and the long-held combat-modes plan is its own engine-side track), **time-meaning** (the clock should be a decision, not a toll), **world-aliveness**, **world agency**, **world variety**, **world coherence**, **ownership**, **RP frame variety**, and **legibility**. A secondary tag never substitutes for a pillar; an item with only a secondary tag is polish, and should be read as such when sequencing.

---

## Old-number index

| Old | Now | | Old | Now |
|---|---|---|---|---|
| 1 | E1 | | 11 | E3 |
| 2 | E2 | | 12 | L1 |
| 3 | W6 | | 13 | **0.10 (next release)** + L3 |
| 4 | W6 | | 14 | E6 |
| 5 | E4 | | 15 | W4 |
| 6 | E5 | | 16 | folded into S1 (first consumer) |
| 7 | **0.7 shipped** | | 17 | W3 |
| 8 | P6 | | 18 | W5 |
| 9 | W1 | | 19 | W2 |
| 10 | P3 | | | |

---

## S — Substrate (load-bearing)

These five gate more of the roadmap than everything else combined. Marked **LOAD-BEARING** with what each gates. **S6 and S7 are deliberately *not* among the five** — neither gates anything. They live here because both are about the seam between the package and its host rather than about the game: S6 is the channel every other item's configuration arrives through, and S7 is a channel the host is already using that this surface has never answered.

### S1. The GM write-back channel — LOAD-BEARING

**What:** a bounded, closed vocabulary of world-state flags the GM can set through a structured side-channel (the package already consumes host signals; this is the reverse lane): `closed:<zone>`, `damaged:<zone>`, `shelter:<zone>`, `hold:<npc>@<zone>`, `gone:<npc>`, `hail:<npc>`. Flags select from **pre-built variants** — soot tint plus the existing roof-stripping, a boarded door, a nave re-laid with the existing `dormitory()`. The founding rule extended in time: *the LLM decides what happened; the algorithm decides how it looks.* The model never gains geometry authority.

**Pillar:** Consequence. **Unlocks / gates:** old item 16 (refugees/tents become *one flag* plus a tent placer — build the mechanism, not the bespoke feature), quest outcomes with visible results, construction states (P6), the recruit's unmanned stall (E4), GM-driven hails (L5), disposition bumps (P2), protagonist steering (E5). **Depends on:** an engine-side structured GM-output channel — the one hard external dependency on this roadmap; start that conversation before anything else even if S1 ships later. **And a reload contract:** flags mutate the world, which `simFromSaved` rebuilds from the seed, so without one every consequence dies at the next load — see S5 for the three options, and pick one before shipping this. **Companion:** its first two consumers (shelter re-lay, boarded door) should ship *with* it so the channel is never live and invisible.

### S2. Inspect / Use — the second verb — LOAD-BEARING

**What:** extend E-targeting beyond NPCs to features, signs, doors, furniture. Two grades matching the clock covenant: **Inspect is free** (talk-shaped — `[Player examines The Long Furrows (crop-plots)]`, the GM riffs), **Use costs time** (the trigger surface for every P3 action).

**Pillar:** The second verb. **Unlocks / gates:** the REST of P3 (actions need a trigger), W2 (enterables need a door handle), P4 (the quest board is an inspectable), and the pouch's front door. The whole existing map — every placer output, every 0.10 room's furniture — becomes content overnight. **Depends on:** nothing. Cheapest high-leverage item in the document. **Companion:** a once-per-feature flavor injection using the existing zone-flavor metering, so first touches land prose without recurring cost.

**It did NOT ship in 0.11, and 0.12 routed around it rather than through it.** The old suggestion bullet put S2 in 0.11; nothing of it was built. 0.12 then needed a trigger for fishing and the maintainer ruled a **proximity-gated button** instead of waiting (M5, provisional until the 0.12 playtest): the Fish action appears when the player stands beside registered water, exactly as the berth button appears beside a keeper. Two things follow, and both are load-bearing for whoever picks this up. First, **the §9 feature-name consumer is spent** — it landed with the register, so S2 no longer gets to claim it. Second, **the gating helper is deliberately shareable**: the button resolves its target through the same per-frame register lookup a Use verb would want, and the plan that built it promises exactly that much and no more. S2 is not smaller for having been routed around; it is one target vocabulary short of what it was.

### S3. The pouch — items and money — LOAD-BEARING

**What:** minimal player inventory — a list of `{tag, name, qty, quality?}` plus a money integer. Deliberately not an economy: no prices discovering themselves, no markets clearing.

**Pillar:** Things; Call economy (quest rewards). **Unlocks / gates:** P3 yields (a fish that exists), P4 rewards (money), S4 (tools live here), keys (L4), gifts (P2), P6 resources, and shops that finally *sell* something. **Depends on:** nothing. **Companion:** stock the existing shop counters with three buyable things per theme at fixed prices, so money has a sink the day it exists.

### S4. Skills and tools — LOAD-BEARING *(new — from Ruling 2)*

**What:** the shared progression substrate Ruling 2 implies. **Skills:** a small fixed vocabulary aligned to the action verbs (fishing, foraging, mining, crafting — extend only with new verbs), leveling with use and with quest XP; levels shift the RNG tables. **Tools:** items with a quality tier (crude/decent/fine/masterwork, theme-skinned) plus consumable modifiers (bait, charge cells, coffee). Split out as its own item — not folded into fishing — because *every* time-passing action reads it, quests pay into it, and the economy sells it.

**Pillar:** Progression (mechanical); Call economy. **Unlocks / gates:** the specified fishing model (P3), the quest XP loop (P4), the money sink that makes P6's economy circulate (better rod costs money; crafting makes better rods). **Depends on:** S3. **Companion:** visibility policy decided up front (see Open Questions — numbers on screen vs. diegetic prose), so the RP half of the audience never sees a spreadsheet they didn't ask for.

**Shipped in 0.12, and the substrate argument paid off exactly as written.** The quality ladder is `crude/decent/fine/masterwork`, frozen because the INDEX is the tier every multiplier reads, and it **grades tools only** — a named `TOOL_TYPES` set says which rows are graded, so a catch's variant slug and a bait's kind share the same `k` field without sharing a validator. Skills are `{level, xp}` per verb against a level cap of 20, and every tier is **resolved at read** rather than trusted off the save, which is what lets the fishing roll be seeded from numbers two clients cannot disagree about. The money sink arrived with it: the keeper sells rods a rung at a time. What is deliberately dormant is the top half — `fine` and `masterwork` are priced nowhere and graded modifiers are not implemented, so tool multipliers 3 and 4 and the graded-mod tier are live numbers waiting on content. **Open question 5 (skill/XP visibility) got its first answer in practice rather than in the abstract:** a level is announced by a toast the moment it changes and then lives on the character sheet; the xp behind it is sheet-only. So the one number that reaches a player who never opens a panel is the level, and only on the cast that earned it.

### S5. The player state block — LOAD-BEARING *(promoted from open question 2)*

**What:** one namespaced, versioned block in the save holding everything that belongs to the *player* rather than to the world — inventory and money (S3), skills and tool quality (S4), quest state (P4), the day ledger (P5), the relationship ledger (P2), and discovery state (W2). Migration on read, and unknown keys preserved rather than dropped so a downgrade does not silently destroy data a newer build wrote.

**Its version is its OWN, nested inside the block — not `saved.v`.** The snapshot already carries a top-level `v` (`60-save.js`, written into the snapshot and gated on restore), and that integer means "the shape of the save envelope". Reusing it couples every player-state migration to unrelated envelope changes in both directions: an envelope bump forces a player migration that changes nothing, and a player bump invalidates envelopes that were fine. Two things that version at different rates need two integers.

**Why it is its own item and not a footnote on each consumer.** The package has held **zero new save fields since 0.7**, and that discipline is load-bearing: schedules, placement, floors and rooms are all a pure function of `(seed, theme, brief, clock)` — `theme` included, since `PF.world.build(seed, theme, sealedBrief)` takes it separately and the restore path reads `saved.theme` before rebuilding — which is what makes rewind safe and a rebuild byte-identical. Every item above wants to be the first to break it. If they break it one at a time the save grows a field per feature, each with its own ad-hoc default and no migration story, and the first version skew corrupts somebody's game. Designed once, it is a single block with a single version and one rehydration path.

**Pillar:** substrate for Things and both kinds of Progression. **Unlocks / gates:** S3, S4, P2, P4, P5, W2 — every item that has to remember something between sessions. **L** needs nothing: it stays derived from the seed. **E does not fully** — E1 and P4's offline content pack is written by a generation call at creation, and an LLM call is not reproducible from `(seed, theme, brief)` however carefully it is seeded. So the pack is not derived, it is **authored once and persisted as a sealed input, exactly as the brief already is** — same discipline, same salvage rules, its own budget. Regenerating it on load would quietly rewrite dialogue and quest text the player has already read, which is worse than losing it. It is not part of S5 (it belongs to the world, not the player) and it wants its own decision on where it is stored; see open question 10.

**But S5 is NOT the whole persistence story, and the gap is named here so nobody assumes it is.** S1's world flags and P6's construction states mutate the *world*, not the player, and `simFromSaved` rebuilds the world from `(seed, theme, brief)` without restoring any of them. As written, a reload or a timeline rewind erases every visible consequence the narrator caused — the boarded door opens, the burnt barn stands, the half-built forge is finished or never started. Nobody has made that decision, and it must be made before S1 ships rather than discovered after:

- **a sibling world-state block** beside S5, replayed over the compiled world after the rebuild — symmetric, and the only option that creates a persisted block. **Key it by the host's visible-message anchor, not by the clock.** `60-save.js` already states the rule — *"rows anchor to the visible message, so swipes, branches"* rewrite it — and the clock deliberately freezes during dialogue (`30-sim.js`: a conversation must never burn the afternoon), so many messages share one `clockMin` and `(day, clockMin)` is not a unique timeline identity. Key flags by the clock and a rewind can replay another branch's mutations. Store the block in the same route snapshot, ordered, and treat the clock as data the flag carries rather than the name it answers to; or
- **host-authoritative**, if the channel that delivers flags can be re-read on load — **no save fields and no block at all**; the lifetime is whatever the host keeps, and the package holds nothing; or
- **session-only** — **no persistence of any kind**; the lifetime ends with the tab. Defensible for a first cut, but then S1 itself must say so, because "the GM changed the world" and "until you reload" is a promise with a footnote.

Only the first option creates a persisted block, and if it is chosen that block is **separate from S5 with its own lifetime** — world mutations answer to the timeline anchor, player state answers to the player. Conflating those two is how an inventory gets rewound because a door was reopened.

**Scope: route-scoped, and that is inherited rather than newly decided.** `60-save.js` states the covenant in its own header — in routes mode "rows anchor to the visible message, so swipes, branches, and checkpoint loads **rewind the world with the story**". Player state rides in that snapshot alongside everything else, so a rewound turn rewinds what happened during it. That is the coherent reading: the turn is the unit, and undoing a turn undoes the fishing trip inside it. Putting the player block *outside* route snapshots would be the exception, and it would need arguing — it buys "your inventory survives a swipe" at the price of leaving you holding a fish you caught in a branch that no longer exists.

One inconsistency to inherit knowingly: **metadata mode** (older engines) does not rewind at all, which `60-save.js` already documents as a limitation. Player state will diverge across a timeline seam there exactly as world state already does. That is a known gap, not a new one.

**Companion — the rehydration order, which is not obvious and is easy to get wrong.** The S5 player block restores **after** `PF.world.build` and **before** `saved.zone` resolves. If the sibling world-state option is chosen it restores in the same window, first; under host-authoritative or session-only there is no such block and steps 1 and 2 collapse into one:

1. **the world-state block**, *if there is one* — it can *remove* zones, since a flag may close or destroy one;
2. **the S5 player block** — its discovery field can *add* zones, since a found sub-zone is compiled on entry;
3. **then** `saved.zone` resolves, against the set of zones that actually exists.

**Suppression outranks discovery, and the two are not the same kind of fact.** Both can name the same zone — the narrator collapses the cave the player found last week — and running discovery second would otherwise resurrect it. The rule is not disjoint key spaces, which would forbid a perfectly ordinary story; it is that **discovery is a memory and suppression is a present-tense claim**, so:

- a zone the world-state block suppressed **stays suppressed**, whatever discovery says. Gone beats found.
- but discovery is **not erased** by suppression. The player still knows the cave exists; W6's map still shows it; it simply cannot be entered, and `saved.zone` pointing at it lands them at spawn exactly as an unresolvable id already does.

Which is the better story anyway: a place you found and can no longer reach is content, and a place you never knew about is nothing.

The window matters at both ends. World-derived ids — a discovered sub-zone, a bed, a workplace binding — do not exist until the compile has run, so a block rehydrated too early points at nothing. And the restore path already lands the player at spawn for an id it cannot resolve, so a block rehydrated too late has its references silently dropped and the player wakes up somewhere else.

**Depends on:** nothing technically; it is a decision, not a dependency. Sequence it **with or before its first consumer** — which under the suggested plan is S3 in 0.11. **Do not let the first consumer define the schema by accident.**

### S6. The setup flow retires into Game Mode's own *(new — maintainer playtest, 2026-08-24)*

**What:** Pixelforge should not carry a parallel setup. `80-setup.js` replaces the classic wizard body wholesale and has to emit the *entire* required `gameSetupConfig` — genre, setting, tone, difficulty, gmMode, party, plus the World-Maps and combat fields — because the host refuses a launch without them. So every question Game Mode already asks gets asked a second time, on a second form, against a second set of defaults that drift from the engine's. The direction is the other way round: **a toggle on the normal Game Mode setup** that says this chat is played as Pixelforge, plus **an inline seed field** on that same form — copy, paste, reroll, hand it to somebody else — and the package's own dialog goes away. What the package genuinely needs is three fields wide (theme, seed, generate-or-decline) and belongs beside the toggle.

**Pillar:** none — this is the front door, not a gap in the game. **Secondary tag:** legibility. **Unlocks:** one obvious home for every future package setting instead of a second wizard that grows; a seed a player can share and get the same town back; and the end of the defaults drift, which is where the stale "Begin in Hearthvale" label over a sci-fi colony came from. **Depends on:** an engine-side seam — Game Mode's setup has to be able to host a package's own fields. Same class of conversation as S1's channel, and worth opening the same way: early, regardless of ship order. **Down payment shipped in 0.11:** the generate-or-decline toggle, the first of those three fields — unchecked boots the themed default world immediately, with no loading gate and no generation call ever made for that chat.

### S7. The engine's HUD widgets — integrate or suppress *(new — maintainer playtest 2, 2026-08-24)*

**What:** Game Mode's setup generates starting HUD widgets — stat blocks, gauges, counters, lists — writes them to `gameWidgetState` at chat creation, keeps feeding them to the GM's prompt, and lets the GM mutate them mid-turn with `[widget:]` tags. The engine's own HUD draws them on rails either side of the screen. Pixelforge does not draw them either, and they are not on the surface props — a package that wanted them would read `chatMeta.gameWidgetState` itself.

**The RAILS are gated; the SETUP SURFACE is not, and that is the half the maintainer actually met.** Read in `packages/client/src/components/game/GameSurface.tsx` on Engine `staging`. All three sites that draw widgets *during play* carry `!experienceOwnsGame` — the desktop rails, the mobile widget tray, the compact choice-stage rail — which is the right default and is why nothing appears on screen beside the package's own HUD. But `GameWidgetSessionPrepModal` is gated on nothing but its own `open` state at every one of its three mounts. The `mode="initial"` one — the dialog titled **"Review Starting Widgets"** — sits inside the pre-game branch, whose entry condition carries no `experienceOwnsGame` term and which `return`s before *both* experience mounts, so an experience-owned game never reaches the code that would have suppressed it; `handleStartGameRequest` opens it on `normalizedWidgets.length > 0` alone. The two `mode="next"` mounts — one inside that same branch, one at the top level of the main return — are ungated the same way, on `sessionStatus === "concluded" && hudWidgets.length > 0`.

**Which is what explains the playtest.** The maintainer did not find these widgets by reading metadata: they clicked through "Review Starting Widgets" on the way into the game and approved a set of widgets that nothing on this surface will ever draw. The rails being correctly gated is exactly what makes that modal misleading — the one place the widgets are ever shown to the player is the one place that cannot tell them the widgets are about to disappear.

**So a whole setup step runs, persists, is approved by hand, and then draws nothing.** From the maintainer's own chat — generated at creation, shown once in that modal and never drawn since: a `counter` labelled **"Coppers"**, a `stat_block` labelled **"Village Bonds"** holding a number per named NPC, an **"Energy"** gauge, and a **"Curiosities"** list. Two of those four are not decoration — they are *this roadmap's items already implemented by the other half of the machine*. Coppers is a second purse beside S3's. Village Bonds is a second relationship ledger beside P2's. The GM has been playing a game with them the whole time, because they are in its prompt.

**Pillar:** none — it is a seam, not a gap. **Secondary tag:** legibility. **This is a maintainer decision, and the options do not compose.** In rough order of cost:

- **Suppress at setup.** The package's setup step declines widget generation, so the chat never carries any and the GM is never told about a currency the world does not have. Cheapest, most honest, and the one that costs a feature: a player who *wants* a gauge for something Pixelforge has no opinion about loses it.
- **Render them, honestly, as the engine's.** The package draws `chatMeta.gameWidgetState` in its own chrome — a panel, a collapsed drawer — visibly separate from the purse and the clock. No mapping, no reconciliation, two systems on one screen and the player can see which is which. Costs the least design and the most screen.
- **Map the money-like ones onto package state.** Superficially the best and structurally the worst: it makes two writers for one number. The GM moves the widget through `[widget:]`, the berth button moves the purse through `award()`, and every rewind, swipe and branch has to agree about which one won. **Do not pick this without answering P7 first** — a mapping is a bridge, and P7 is the bridge.

**One of the three options got cheaper in 0.12, and it is worth recording which.** "Render them honestly as the engine's" wanted the package to draw metadata in its own chrome — a panel, a collapsed drawer — and the objection to it was screen. 0.12 built exactly that shape for the package's *own* state: a topbar chip opening a full panel, hidden outside walk mode, torn down with the HUD. So the chrome cost of option 2 is now known rather than estimated, and it is one more chip. Nothing else about the fork moved — the modal is still ungated and mapping is still the option that creates two writers for one number.

**Depends on:** nothing to suppress — and suppressing is the only one of the three that also closes the prep modal, since a chat carrying no widgets never opens it. Rendering wants no engine change (the metadata is already on the props) but leaves the modal promising rails that never arrive, so it wants an engine-side gate on those three mounts as a companion. Mapping wants P7's decision and probably S1's channel. **Companion:** whichever is chosen, say it in the package README, because the surface currently makes a promise about "your own HUD" that the setup step contradicts to the player's face on the way in.

---

## L — The living settlement

### L1. NPCs walk *(old 12)*

**What:** pathfinding between schedule anchors instead of the daypart teleport. Trivial at these scales (A\* on ≤104×72, since 0.10 grew the city); the two-pass relocation machinery already solved the hard correctness problem — walking is a path between the same answers.

**Pillar:** world-aliveness. **Companions that make it real rather than animation:** (i) **interception** — an NPC en route is talkable, and the header says "headed to the smithy," one token of pure GM fuel derived from state already held; (ii) **doors** — walkers visibly use them (door tiles are already non-solid and schedule-excluded); an NPC melting through a wall undoes the feature; (iii) **staggered departures** — hash-offset leave times ±20 minutes so the town doesn't move as one organism at 07:00. **Depends on:** nothing; cross-zone relocation machinery exists. **Unlocks:** hails (L5) get literal path-crossings.

### L2. Weather and the calendar

**What:** weather as a **pure function of (seed, day, clockMin)** — the same trick schedules pull; zero save fields, rewind-safe. Rain tint and particles, snow ground-swap, storms. On top: a calendar — `day % 7` gives a week; market day fills the plaza with the existing stall placer; one assembly/sabbath/game-night day per theme.

**Pillar:** time-meaning; Call economy (fully deterministic content). **Unlocks:** a load-bearing header token ("rainy dusk" writes half the scene), schedule modifiers (storm empties the plaza, fills the inn — the town visibly answers the sky), P3 modifiers (fish bite in rain — the clock becomes a decision), a reason to `waitUntil`, W4's calendar hooks (shift-change day, pilgrimage day). **Depends on:** nothing. The best cheap win on the roadmap. **Note:** stays package-local like the clock; the header word keeps the GM consistent (see Open Questions re host weather).

**It did not ship in 0.11 and was deliberately held out of 0.12** (maintainer ruling, 2026-08-24). 0.12 wanted exactly one of its three parts — a modifier column for the catch tables — and taking one part would have shipped weather that the world cannot see and the GM is never told about, which is the worst version of it. So **L2 lands WHOLE or not at all: the function, the header word, and the tint together.** Daypart is 0.12's only live modifier; the catch tables' second modifier column is comment-marked and empty, waiting for this.

**AMENDED — the same ruling round adds a fourth part, and it is what makes weather a settlement feature rather than a filter over the screen. Weather BIASES NPC SCHEDULES: indoors unless the job is an outdoor one.** A shepherd is out in the rain and a scholar is not, so the storm that empties the plaza does it by moving named people to named places rather than by dimming the tiles they are standing on — which is the same discipline L3 applies to rooms and the schedule module has already learned once (the keeper tier exists because the church was empty exactly when players walked into it). The handle it needs is the trade half of E3's `kind` split, or a per-kind outdoor flag standing in for it until that lands. Note the cost this adds to the "best cheap win" label: the sky is cheap, the town answering it is not, and the item is now both.

### L3. Room-grain schedules and occupancy *(runtime companion to 0.10)*

**What:** grow the schedule handle vocabulary to room grain — hearth, workbench, table, bed — so 0.10's named rooms have occupants at the hours players open doors: dinner in the dining room, the scholar in the study. The schedule module already learned this lesson once (the keeper tier exists because the church was empty exactly when players entered); apply it to rooms.

**First handle shipped with 0.10:** `hearth`. An ordinary resident's dawn and dusk now anchor to the fire (resolved from the *bed's* zone with the floor suffix stripped, since a household sleeps upstairs while the fire is downstairs; falls back to `post` when there is nothing to stand at), so a settlement is home at first and last light instead of standing at its work anchors from waking to sleeping — and a lit window at dusk means somebody is behind it. What remains: the rest of the vocabulary, and occupancy for the rooms 0.10 is cutting — the kitchen and dining areas are recorded and still unoccupied at exactly the hours that would sell them.

**Pillar:** world-aliveness. **Unlocks:** room names in the dialogue header ("in the kitchen of the Wet Boot") — free spatial specificity for the GM; S2's richest inspect targets (0.10 furniture should land pre-tagged). **Depends on:** 0.10.

### L4. Hours and locked doors

**What:** doors lock by schedule — shops close at night, homes close to strangers. A locked door is a toast and a GM line ("you could knock"), never a hard wall.

**Pillar:** soft stakes. **Unlocks:** night becomes a different place rather than a darker one; rapport gets its mechanical payoff (friendship literally opens doors — P2); keys become the first meaningful item (S3); trespass becomes an expressible story the GM can react to. Modern read is effortless (keycards, closing time). **Depends on:** basic version nothing; the good version reads P2.

### L5. Hails — NPCs who start it

**What:** rate-limited, deterministic NPC-initiated contact: a bubble ("Alder waves you over"); answering opens dialogue with a prefix saying *they* initiated and why (persona + situation + disposition).

**Pillar:** world agency. **Unlocks:** personas pay off without the player grinding every door; S1 gains a queueable "have X approach the player" op — the single most useful GM request available; recruits (E4) get their approach vector; quest-givers (P4) can flag you down about the job. **Depends on:** nothing hard; better with P2 and L1.

### L6. Presence follows the narration *(new — maintainer playtest, 2026-08-24)*

**What:** when the GM narrates the player into a place — and any named, present NPC along with them — the sim should go there. Today the story moves and the sprite does not: the narrator walks you into the cantina and you are still standing in the square, which reads as a world that is not listening. Two shapes, not exclusive: **teleport-on-narration**, the cheap one, landing the party at the named zone's spawn; and **cutscene presentation**, the honest one, where the existing beat machinery covers the move so the player watches a transition instead of being cut mid-step.

**The beachhead exists and its limits are the item.** `50-spatial.js` already follows narrated drift — when the host commits a new party location, the package teleports to the zone bound to it. What it cannot do is the rest: the binding only covers zones the maps export registered, an interior the GM names in *prose* that the host never commits is invisible to it, and **NPCs never move at all** — a character the narrator puts in the room with you is still asleep in their own house, which is the half that breaks a scene fastest.

**Pillar:** Consequence. **Secondary tags:** world-aliveness, world coherence. **Unlocks:** every scene the GM sets somewhere specific stops needing the player to walk there first; L5's hails get a place to happen; E4's follower has a mechanism to follow *with*. **Depends on:** nothing for the host-committed half beyond widening the bindings; the prose-only half is the GM→world direction and wants S1's channel — a `move:<npc>@<zone>` flag is the same vocabulary and the same validation problem. **Companion:** decide what a *contradicted* move does — the narrator puts you in the inn, you walk out, the next turn narrates you still there — because a teleport that fights the player is worse than one that never fires.

**AMENDED — maintainer ruling, playtest 2, 2026-08-24. The item above asked how to move the player; the ruling is mostly that the GM should not.** Teleporting the PLAYER is **sparing** and reserved for the two cases where refusing to move them is the absurd answer: **forced travel** (arrested and marched to a cell, carried off) and **time-skips** (boarding a train and arriving). Both of those are the story taking the player somewhere against or beyond their own step, and **both must advance the world clock accordingly** — a journey that costs no hours is a cut, not a journey, and the package owns a clock precisely so it can be spent.

**Otherwise the player WALKS, and that is a feature and not a shortfall.** Location-gating is the pacing mechanism: the narration and the questline continue when the player reaches the place, finds the person, or carries the thing. That is also the standing answer to "no lulls, nothing ever blocks progression" — the gap between turns is not dead air, it is the walk, and a world where the narrator delivers you to every scene has no reason for the map to exist. **What this changes about the item above:** teleport-on-narration stops being the cheap default and becomes the narrow case; the honest cutscene presentation is what the narrow case gets. **NPC presence is untouched by the ruling** — a character the narrator puts in the room is still the half that breaks a scene fastest, and moving *them* is not moving the player.

**Adjacent, same session, and not settled: the clock runs while the GM writes.** Real seconds pass during generation and the package's clock converts them, so a slow turn ages the town by the length of the wait — the sim advancing on wall-clock time while the player is doing nothing but reading. The rule the module already keeps is the precedent: `30-sim.js` freezes the clock in dialogue because "a conversation should never burn the afternoon." Generation is the same argument with a different name. Evaluate pausing the sim clock while a turn is being written — the package already receives `isStreaming`, so the signal costs nothing; what wants deciding is whether NPC wander pauses with it (it does not in dialogue, deliberately: the world stays alive while you read) and what a paused clock does to `_clockAcc` across a chat switch.

### L7. Autonomous world change — factions *(new — maintainer ruling, 2026-08-24)*

**What:** the world should change **without the player being involved in it at all**. Dwarf Fortress and Kenshi are the named references, and the reference is the point: the interesting thing about those worlds is not that things happen, it is that things happen to *somebody else* and you find out afterwards. Factions are the shape the ruling gives it — bodies with interests that act on the settlement over days, so a town the player left is not the town they come back to.

**No mechanism exists yet, and this entry is deliberately not designing one.** What it records is the ruling and the one seam already built for it. Every other item in this group moves people the compiler placed, on schedules the compiler wrote, inside a world that is a pure function of its seed — which is exactly the property a faction has to break, and that is S5's sibling world-state block all over again (see S5's three options; this item is the second consumer that decision was waiting for, after S1).

**The seam that exists: the notice band.** 0.12 gave the journal a band that sits outside the day groups and answers "what happened to the world itself, rather than in your days in it" — severances, losses, a save coming home. Its framing sentence and its five writer-site strings were reviewed under a maintainer amendment (M3) that asked each of them to name **its kind's relationship to the player**, and the band was written to receive one more field it does not have yet: **an actor**. A notice that can say *who* did the thing is the difference between "the mill burned" and "the Hearth Guild burned the mill", and the band is the surface that sentence lands on. Nothing in 0.12 can produce an actor, which is stated in the code rather than implied — a faction is what fills that field in.

**Pillar:** Consequence; world agency. **Secondary tags:** world-aliveness, world variety. **Unlocks:** the strongest reason yet to return to a settlement; quest hooks that write themselves (P4); a source of S1-shaped world flags that is not the GM, which is worth noticing — this and S1 want the same closed vocabulary of world mutations and should not invent two. **Depends on:** the world-persistence decision in S5, and it is the item that makes deferring that decision expensive. Reads well with W4's specialization axis (a mining town has something a faction wants) and W3's districts (a faction holds a ward).

---

## P — The player's stake

### P1. The player home

**What:** the player currently has no bed, door, or tile of their own. Mint one dwelling (the machinery all exists), or place the player as a lodger at the inn via the wizard.

**Pillar:** ownership. **Unlocks:** `waitUntil("dawn")` becomes *sleeping in your bed*; **the P5 wrap-up boundary gets its trigger**; storage gives items a place to live; P6 gets its first and most-motivating upgrade target; the GM gets a persistent "home" anchor. Four payoffs, one lot. **Depends on:** nothing. Ruling 1 raised this item's priority: the quest layer's day boundary is a bed.

**The FIELD shipped in 0.11 and the second payoff cashed in 0.12; the lot did not, and open question 9 is why.** The maintainer ruled against an automatic home — a modern setting probably houses its protagonist and a wandering adventurer probably does not, and only the setup and the GM know which — so 0.11 shipped the anchor and the player-driven path to filling it: renting a berth at the inn. 0.12 then spent it, and spent it exactly as promised: **Sleep is bed-gated on that same anchor**, so "in your home zone" and "in a lodging zone you have paid for" are one test rather than two, and the wrap-up boundary fires there and nowhere else. What that leaves is the ownership half — a tile of your own, storage, and something for P6 to upgrade — plus the honest consequence of stopping here: **a player who never rents anything never sleeps, so their ledger never flushes.** That is one of P5's two accepted never-flush classes and it is P1-shaped, not P5-shaped.

### P2. The relationship ledger

**What:** per-NPC player-facing state: `met` (the persona one-shot flag already half-is this), a five-step disposition (stranger/acquainted/friendly/close/hostile), optionally one line of "last thing between you." Surfaced in the per-turn header — `near: Alder Vance (hedge-mayor, friendly)`. Bumped heuristically (talk count, gifts, **completed quests for the giver** — Ruling 1's "rapport") and precisely via S1.

**Pillar:** Progression (social) — and it fattens the *persistent* GM channel, where this architecture keeps its truth once one-shots burn. **Unlocks:** recruitment thresholds (E4), door access (L4), the data shape E6 shares, social memory at 400-turn horizons, quest rapport rewards. **Depends on:** nothing for the heuristic version; S1 for GM-driven bumps.

### P3. Time-passing actions *(old 10)*

**What:** fishing, mining, foraging, crafting — every one advances the clock (talking stays free; combat's cost stays the GM's). Per Ruling 2, resolution is **RNG tables with inputs**: skill level (S4) and tool/bait quality (S3/S4) set what can be caught and the success rate. No reflex gates.

**Pillar:** the second verb; time-meaning; Call economy (resolves offline). **The full stack, because any one part alone is a stub:** (i) **a target** — the action binds to a named feature via Use (S2), so the GM knows *where*; (ii) **a yield** — the fish exists afterward (S3); (iii) **a receipt** — `[Fished at the Millpond until dusk. Caught: one pale carp.]`, so the narrator can pay off the cost — or, leaner, the line goes to the P5 day ledger instead of spending a turn; (iv) **a modifier** — daypart/weather (L2) affects tables, making the clock a decision. Fold `waitUntil` in: "fish until dusk" as a compound gives actions an intent-sized grain. **Depends on:** S2, S3; S4 for the specified model; L2 for modifiers.

**Fishing shipped whole in 0.12 — all four parts of the stack, which was the condition this item set for itself.** (i) **The target** is a per-zone **feature register**: the compiler records what it placed as `{id, tag, name, rect}` and the sim resolves "the player is standing beside registered water" every walking frame. Derived from the sealed brief, never serialized, so it costs no save bytes. The trigger is a proximity button rather than S2's Use verb (see S2). (ii) **The yield** is a per-`(theme, spot-kind)` catch table whose rows carry a shared **role** and a **variant slug**, so a kelp never merges into a carp in the pouch and a colony can stock real fish beside flavoured ones. Bait is a yield in its own right — fishing is its own supplier. (iii) **The receipt** takes the leaner branch this item already preferred: no per-cast turn is spent, and a session writes **one batched ledger line per day it spans** for P5 to tell. (iv) **The modifier** is daypart only; the weather column is built and empty (L2). Around them: a cast is one fixed **window** of clock that wraps midnight, a session is a loop over windows with a "fish until <daypart>" target, and every roll is seeded from resolved numbers so the same state on the same minute lands the same fish — which makes a failed cast a fixed point you escape by spending different time, and is the anti-save-scum property stated rather than discovered.

**Also shipped: the economy around it, because a verb with no acquisition is a verb nobody has.** Rods are **never free** (maintainer amendment): the inn keeper doubles as outfitter and sells the next rung the player lacks — no rod quotes `crude`, a crude owner quotes `decent`, a decent owner is quoted nothing and the button goes away. The first purchase throws in a starter bait stack at the theme's own first bait slug so it merges with what gets fished up. Acquisition is **per theme** because fishing means different things in different worlds: the fantasy entry rod is cheap, the sci-fi one is quoted at four times the price as an INTERIM until P11's hobby-store/online path lands and takes it off the keeper. And it is **never forced** — a proximity button, no modal, no gate, and nothing anywhere in the package depends on owning a rod.

**What remains of P3:** mining, foraging and crafting, each of which needs its own target vocabulary (S2, or a second register tag), its own tables, and a place to spend what it yields. The substrate is now built rather than argued about, so the second verb of the four should be much cheaper than the first.

### P4. The quest layer *(new — Ruling 1)*

**What:** generic, grindable, **offline-resolvable** quests for money, XP, and rapport — the lean-with-AI-calls play mode.

- **The board:** a diegetic surface with a placer per theme (parchment board / job kiosk / corkboard-and-gig-app) — inspectable via S2, ignorable forever.
- **The content:** quest templates authored **at creation in the same generation call as the E1 dialogue pack** (it is the same problem: canned content, state-indexed), refreshed at runtime by deterministic seeded templating (`hash(seed, day, board)`) so the board restocks without calls.
- **The verbs:** only what the package can verify offline — gather/catch N (reads the pouch), deliver to X (reads position + talk), visit Y (reads zone entry). Combat-shaped quests wait for the engine-combat question (Open Questions).
- **Rewards:** money (S3), XP (S4), rapport with the giver (P2).
- **The covenant:** quests resolve package-side; the GM is *informed at boundaries* (P5), never tracked step-by-step, and — design rule — **the quest layer must never make the narrator wrong**: quest state binds tiles and tables, not the GM's prose.
- **Never forced:** no main-quest pointer, no quest-gated core systems; where W1 uses "by quest" as a travel key, the gate must accept alternative keys (vehicle, fee, rapport) so slice-of-life players are never conscripted.

**Pillar:** Call economy; Progression (both kinds). **Unlocks:** an entire second way to play the same world. **Depends on:** S2, S3, S4, P5; E1's generation batch.

### P5. The day ledger and sleep wrap-up *(new — Ruling 1's boundary, generalized)*

**What:** a package-side journal buffer that accumulates one-line entries through the day — quests taken/completed, notable catches, money earned, weather worth mentioning — and flushes as **one metered injection when the player sleeps** ("You quested; here is what happened"), burning on accepted turn exactly like the existing one-shots. The maintainer's wrap-up boundary, built as a general mechanism: useful even with zero quests ("you fished all afternoon and the rain came in"), so the GM stays honest about offline time at day grain without per-step taxation.

**Pillar:** Call economy; Consequence (the narration side of it). **Unlocks:** P4's GM-awareness contract; a natural save/chapter rhythm. **Depends on:** P1 — **hard**, not soft: the wrap-up fires when the player sleeps, so with no bed anywhere there is no boundary and the ledger never flushes (inn berths count as a bed). Plus the injection-discipline machinery, which exists.

**Shipped in 0.12, as three things rather than one.** **Sleep** is "sleep until \<time of day\>" over the same four dayparts the Wait menu offers — any hour, bed-gated, walk-mode only, and it **sends nothing**. **The flush** is two fields and the split is the whole design: a durable marker inside the save records the last day a completed sleep made *owed*, and an ephemeral half is handed to whichever sender composes next. So the day is summarised into the turn the player was going to send anyway, for their own reasons, and sleeping costs no GM call by itself — which is the answer to open question 7, taken as "prefixed to the next player-initiated turn". Any completed sleep owes **every** elapsed day (maintainer ruling), so the post-midnight fisher who beds at 00:30 flushes last night's catch and the release does not need a "you slept through midnight" special case. The burn **guards itself** against a rewound sim rather than trusting the caller. **The journal panel** is a topbar chip and one list, day-grouped newest-first, with a **notice band** outside the grouping for the things that happened to the save rather than in a day (see L7 for what that band is built to grow).

**Two accepted limitations, stated because both are recorded as decisions.** A player who never rents a bed and a player who only ever Waits never flush at all — and both classes become self-correcting the moment **P10's sleep-deprivation debuff** lands, which is one of the reasons that item exists. And a lost flush, or a rewind across a sleep, can re-tell a day; the ledger is a buffer, not a transcript of what the GM has been told.

### P6. Resources, building, upgrading *(old 8)*

**What:** spend resources and money to build and upgrade.

**Pillar:** ownership; Progression. **Companions:** (i) **the player home first** (P1) — motivation before infrastructure; (ii) **visible construction states** — scaffolding-for-N-days via an S1-style flag overlay; instant completion wastes the clock system; (iii) **source resources from `surround`** — woods→timber, rocky→stone, water→fish, barren→salvage — giving a sealed 0.4 field its first mechanical consumer, the §9 pattern working as designed; (iv) upgrades are **choices between compiled variants**, never tile placement (see Will Not Build). **Depends on:** S3; S1 for construction states; P3 for gathering.

### P7. The GM–ledger bridge — narrated transactions that move nothing *(new — maintainer playtest 2, 2026-08-24)*

**What:** the GM narrates the economy freely and none of it reaches the package. From the maintainer's own session: the narration had them hand over coins for a room and granted them a **"Brass Room Key"** in the engine's inventory; the engine's Coppers counter went down by two. Pixelforge's purse was still 40, its pouch still empty, and `player.home` still null — the ledger's only line was the one the starting purse wrote. The player paid for a room they do not have, in money they never had, and got a key the package cannot open a door with.

**Three parallel economies, and the package has no writer on any of the other two.** Money: the engine's `Coppers` widget beside S3's purse. Items: the engine's `gameInventory` beside the pouch — which is doubly pointed, because the package's own item vocabulary calls a `lodging-key` a **"room key"** in this very theme, so the two systems independently invented the same object and neither can see the other's. Rapport: the engine's `Village Bonds` stat block beside P2's `rel`. See S7: those widgets are the same finding from the other side.

**Until this is bridged, the mechanical verbs are the only real economy.** In 0.11 that was the berth button and nothing else. **0.12 made the gap wider, not narrower**, and it is worth saying plainly: there are now four mechanical verbs the GM cannot see or move — renting a berth, buying a rod, fishing, and sleeping — plus a purse, a pouch full of named fish, a skill level, and a day ledger. The GM is told about exactly one slice of that, once a day, at the wrap-up, by a channel that runs one way. Everything else is a narrator improvising prices for a shop it has never been shown. What the GM says about money is flavour; what the button does is the game.

**Two directions, and they are not alternatives so much as a cheap one and a right one.**

- **Constrain by prompt contract** — the GM is told, in the injected header or the system prompt, that it narrates around the package's ledger and never moves it: no prices, no handovers, no granted objects. Cheap, immediate, and only as reliable as any prompt instruction, which is to say it will hold most turns and fail on the interesting one.
- **Give the GM real verbs** — `rentBerth`, `grant`, `take`, `award` exposed as GM-visible actions or tools, so "you hand over the coins" IS `award({ money: -12 })` and the receipt the player sees is the purse changing. This is S1's channel wearing an economy hat: the same untrusted-model-output validation problem, the same bounded vocabulary discipline, and the same hard external dependency. Note it inherits S5's rewind contract for free — every one of those verbs is already a shipped mutator that writes into the route-anchored snapshot, so a rewound turn rewinds the purchase, which is exactly what a narrated purchase should do.

**Pillar:** Consequence; Things. **Unlocks:** the GM can finally pay a quest out (P4's rewards stop being prose), P2's disposition gets its precise bumps, and the "you already keep a berth here" refusal stops being the only sentence in the game that knows whether you paid. **Depends on:** S1's channel for the real version; nothing for the prompt contract. **Companion:** whichever way it goes, S7's decision has to agree with it — a widget the GM decrements and a purse the package decrements cannot both be the money.

### P8. Ruleset-pluggable character sheets *(new — maintainer ruling, 2026-08-24)*

**What:** the character sheet should be able to wear a **ruleset**. A 5e spread and a V20 spread are different rows over largely the same underlying facts, and a player who plays one of those systems wants to see their character in its own vocabulary rather than in the package's. Not a rules engine — the package is not going to resolve a save-or-suck — a **presentation layer**: which sections exist, what they are called, what arithmetic derives a shown number from the block, and which of them the RP player can hide.

**The hook is already in the code, which is why this is an item and not a wish.** 0.12's sheet does not build DOM; it builds a **descriptor** — `[{section, rows: [{label, value, kind, detail?, source?}]}]` — and renders that. Swapping the function that produces the descriptor is the whole of a ruleset, and the 0.12 descriptor is by construction one such function (call it "the package's own"). Two properties of the shipped sheet a ruleset must not break: the render is driven by a **live value key** rather than built at open, and that key is **the projection of precisely what the sheet renders** — so a spread that shows a new fact widens the key in the same change or that fact never re-renders. And `detail`/`source` ship in the row shape **empty**, reserved for the perk and boon text P9 writes: a shape grown later is a shape every consumer has to be re-taught.

**Compact sheet, extended journal** (maintainer amendment, and it is the sequencing note for this item): the sheet stays the compact primary view, and the *extended* viewability surface — a big ruleset's full skill list, a perk's description, where a bonus came from — is a tab of the journal panel. 0.12 shipped the seam and not an empty tab, per the same decoration-before-behaviour rule that holds the quest log to 0.13.

**Pillar:** Progression (legibility of it). **Secondary tags:** RP frame variety, legibility. **Unlocks:** P9's perks get somewhere to be read; open question 5's visibility fork gets a real answer (a ruleset can be the diegetic one); a table-top player recognises their character. **Depends on:** nothing package-side. **Two Engine FRs are enumerated here because both are the engine's to give and neither blocks the item:**

- **Persona name and avatar exposure.** The package has no player name or portrait and the host props expose none, so the sheet draws the walk sprite and captions it with a themed generic label — "Traveler" in the valley, "Drifter" in the colony. The chat has a persona with a name and an image; a package that could read them would put the player's own face on their own sheet.
- **A package slot in the inventory panel.** The engine draws its own inventory and the package draws its own pouch, and they are different bags (see P7). A slot an experience can render into would at least put the two in one place for the player, which is the cheapest honest version of that reconciliation and does not require deciding P7 first.

### P9. Boons, perks and enchanted equipment *(new — maintainer ruling, 2026-08-24)*

**What:** equipment and effects that carry **stat perks** — an enchanted rod, a blessing, a trained knack — rather than only a quality tier. S4 shipped the ladder a tool sits on (`crude → masterwork`) and one consumable modifier class (bait); this is the axis beside it, where a thing is not *better* so much as it is *different*, and where the description is half the point.

**Two things it must share rather than reinvent.** First, **P8's `detail`/`source` seam**: a perk without a sentence explaining where it came from is a number on a sheet, and the journal's extended-character tab is the surface those sentences were reserved for. Second, **the status-effect vocabulary P10 introduces** — a boon that buffs and a debuff that penalises are the same mechanism pointed two ways, and the package should own exactly one of them. Whichever of the two lands first writes it.

**Pillar:** Progression (mechanical); Things. **Secondary tag:** RP frame variety. **Unlocks:** quest rewards that are not money (P4); a reason for P6's crafting to make something rather than another rung of the same ladder; the dormant upper half of S4's tool multipliers finally has content that is not just "an expensive rod". **Depends on:** S3/S4 for where they live; P8 for where they are read; P10's vocabulary, or it writes that vocabulary itself.

### P10. The sleep-deprivation debuff *(new — maintainer ruling, 2026-08-24)*

**What:** a status that begins **after 24 hours without sleep** and whose severity **increments the longer the player stays awake**. It encourages — or forces — a sleep cadence.

**Why it is on the roadmap and not in a bug tracker: it is the fix for two accepted limitations at once.** P5's wrap-up flushes on sleep, and 0.12 accepts **two never-flush classes** — the player with no bed anywhere, and the player who only ever Waits. Both of them are people the ledger silently accumulates for and never tells. A debuff that makes staying awake cost something turns both classes from permanent states into choices with a price, and pushes the ordinary player toward the cadence the flush was designed around.

**Implementer notes, recorded now because they are the parts that are not obvious.** (i) It needs a **last-slept marker**, which is new serialized state — the first player-block field since 0.12's own wrap-up marker, and it belongs in the block under the same rules (declare its field class, add it to the key list, put it in the wire order). (ii) It is the package's **first status effect**, so it writes the vocabulary P9 will share: a severity, a source, a display string, and a rule for what reads it. (iii) Its display surface is **P8's `detail`/`source` seam** — the sheet says what is wrong and the extended tab says since when. (iv) Decide early whether it touches the RNG tables (a tired angler casts worse) or stays presentational; the first makes it a real mechanic and the second makes it a mood.

**Pillar:** time-meaning; soft stakes. **Depends on:** the player block (exists); P5's boundary (exists). Reads best with P8 and P9, and blocks neither.

### P11. The smart device — online shopping and hobby acquisition *(new — maintainer ruling M12, 2026-08-24)*

**What:** a **device menu** for the themes that would have one — sci-fi now, "modern" when it exists (W9). A phone or a handheld terminal that opens a small in-fiction interface: **online shopping** first, and a **hobby store** as its most-wanted front, because that is the acquisition path a niche pastime actually has in a world with parcels in it.

**It has a migration waiting for it, and that is the reason it is filed rather than mused about.** 0.12's rod acquisition is per-theme by ruling: fishing is a common thing to do in a valley so the inn keeper sells a cheap entry rod, and it is a **niche hobby** in a colony so the same keeper quotes four times the price. The premium is explicitly an **interim** standing in for a mechanic that does not exist yet. When this lands, **sci-fi rod acquisition moves off the keeper and onto the device**, and the interim comes out.

**Pillar:** Things (acquisition); world variety. **Secondary tag:** RP frame variety. **Unlocks:** a money sink that is not a person you have to stand next to — which matters more than it sounds, because every purchase in the package today requires finding a keeper; a natural home for goods no NPC would plausibly stock; and a second acquisition idiom for P9's equipment. **Depends on:** S3's vocabulary and price tables (exist). **Companion, and it is the constraint:** the device is a *theme-owned* surface, not a universal one — a cozy village must never grow a delivery app — so it wants the same per-theme gating the item skins already use, and a theme that has no device simply has none.

---

## W — The wider world

### W1. Travel gating and vehicles *(old 9)*

**What:** gate travel by quest, vehicle, fee, or rapport — a gate must accept more than one key (see P4's covenant).

**Pillar:** the unknown. **Companions:** **somewhere to go** (W2 — a gate with nothing behind it is a wall) and **the vehicle as a themed feature**: every theme names its vehicle in the placer registry — dock/boat, pad/shuttle, bus-stop/bicycle — one gating system, three skins; sailing generalized. The sailing case lives here: the boat is a travel key *and* a fishing multiplier *and* an exploration verb. **Depends on:** W2 for payoff; S3 for fees/tickets.

### W2. Enterables and the expedition ladder *(old 19 + new)*

**What:** enterable ruins and lookouts — plus the reason to enter: **lazily-compiled sub-zones** chained off wilds edges and enterable features (the cave behind the ruin, deeper woods, a derelict deck below the hull), deterministic from `hash(seed, edgeId, depth)`, compiled on first entry. The unknown *exists without pre-existing*; the sealed brief stays sealed.

**Pillar:** the unknown — the missing half of exploration: destinations that don't exist yet. **Unlocks:** W1 gets something behind the gate; P3's mining/foraging get places that feel earned; sailing gets shores worth landing on. **Companions:** the S2 once-per-feature flavor injection, so first entry always lands prose — and **discovery state**, which needs saying precisely because it is a promise the save format cannot currently keep. A found place staying found is save data, and the snapshot has no discovery field; `simFromSaved` restores none. So either it rides the versioned player block of Open Question 2 (rehydrated after `PF.world.build` and before `saved.zone` resolves), or **discovery is session-only and W2 must say so out loud**. Do not ship the ladder with the stronger promise implied and the weaker behaviour built. **Depends on:** S2; benefits from 0.10's room vocabulary; deliberately sequenced late because its payoff multiplies with what's coming — the one deferral justified by dependency, not art.

### W3. Cities and districts *(old 17 — the density half shipped in 0.10; districts remain)*

**What:** the `city` scale shipped in 0.9 at 96×72; **0.10 shipped the density half** — the map raised to 104×72 with 80 lots, population derived from rank and prosperity (~120 souls measured), minted residents, round-robin households, parks on the lots nobody claimed, and day anchors spread so a quarter of the town keeps the square while the rest hold the street outside their own doors. What remains is **districts with their own gravity** — a ward `public` handle per district (the anchor spread stops the plaza crush, but "the street outside your own door" is a stopgap, not a neighbourhood; one plaza serving 104×72 is still a village in a coat), district market days (L2), and district names in the header. 0.10 turned this from polish into a due bill: at 80 lots and 120 souls the single-`public` town is visibly under-articulated. **A note on `backgroundPopulation`:** 0.10 gave the §9 reserved field its first consumer — it moves a settlement *within* its rank's band and can never set the band — so "cashed out as ambient walker density per district" is no longer the field's first job, but it survives as the district-grain second consumer if districts want it.

**Companion — apartments as a choice, not only a fallback.** Round-robin sharing exists as over-subscription behaviour; a dense rank could *choose* to stack households — a tenement row, a hab block — and spend the ground it frees on district squares, markets and parks. The leftover-lot machinery already knows what to do with ground nobody built on; this hands it more of it, on purpose.

**Pillar:** world variety. **Depends on:** L2 for district calendars; W6's map surface stops being optional at this scale.

### W4. The specialization axis *(old 15)*

**What:** settlement specialization (mining town, market town, pilgrimage town, college town) as an axis beside scale and prosperity.

**Pillar:** world variety. **Companion — the whole item:** **cascade it through the vocabularies, not just the counts.** Fewer inn beds is bookkeeping nobody sees. One enum value should pick: placers (a mine, a workyard bias, tailings), cast-kind priors (more miners), **a schedule column** (the day shift vanishes underground and the streets visibly empty at 08:00), and **a calendar hook** (shift-change day, market day, holy day). That cascade is what makes one word feel like a different town instead of a different spreadsheet. **Depends on:** L2 for calendar hooks; W5 for the anchor place-kinds.

### W5. Place-kind expansion *(old 18)*

**What:** market, bathhouse, school, infirmary, keep, graveyard, mine, dock, communal residence.

**Pillar:** world variety. **Companion, as a hard rule:** **no new place-kind ships without its schedule column and its calendar hook.** A school without school-hours is a building-shaped rock — and pupils finally give the `child` kind a daytime anchor besides the plaza. Bathhouse peaks at dusk; the graveyard gets mourners; the infirmary is the `healer`'s workplace; the market *is* a calendar day made of stone. The codebase paid for this lesson once already (the keeper tier's empty church). **And a ground note from 0.10:** a place now costs a lot the street grid must seat, and a rank seals only what its ground can hold — the over-ask lands in `repairs` rather than on the floor — so a new place-kind's cost is paid in lots per rank, not just in schedule columns. **Depends on:** dock pairs with W1; mine pairs with W4 and P3.

### W6. World reuse and the map surface *(old 3, 4 + new)*

**What:** two small things folded together. (i) **Reuse:** the sealed brief + seed pair already *is* the reusable asset; what's missing is a browse/replay surface — UI, not world-gen. Low urgency. (ii) **The in-game map:** auto-drawn from compiled zones (the data exists), fog-of-war revealing zones/POIs as visited — exploration made legible as visible progress.

**Pillar:** the unknown (legibility). **Depends on:** nothing; becomes load-bearing at city scale (W3) and with expeditions (W2).

### W7. Venue variety, and districts you can find your way around *(new — maintainer playtest, 2026-08-24)*

**What:** a generated settlement reads as a grid of homes plus a farm. The vocabulary is already richer than what reaches the ground — `gathering`, `workshop`, `hall` and `sanctuary` are sealed place-kinds today — but a settlement only gets one if the model names it, and the repair layer's floor is a single wilds. Three parts. **Named venues surfaced more aggressively:** a floor per rank rather than only a ceiling, so a village whose brief named no places still has somewhere that is not somebody's house. **District naming:** W3's remaining half is a gravity well, and this is the other one — a ward is a name in the header before it is an anchor spread. **Discoverability:** a player standing in the street should be able to find the inn, by the map surface (W6), by a sign the second verb can read (S2), or by the travel list naming what a zone *is* and not only what it is called.

**Pillar:** world variety. **Secondary tag:** legibility. **Relationship to W3 and W5, said plainly so nobody builds it twice:** W3 owns the district *machinery* (per-district `public` handles, district market days) and W5 owns *new* place-kinds with their schedule columns; W7 is the texture pass over both — floors and surfacing for the kinds that already exist, and names for the wards W3 carves. **Depends on:** nothing to start (the floor is a repair-layer change and a lot budget); W6 for the map half; S2 for the sign half.

**The bug half is closed; this is the feature half.** 0.11 found the case where a settlement could seal with a keeper and *no gathering at all* — the §4.3 host synthesis ran against the model's draft cast, one pass before the quality floor topped a host up from stock, so a brief whose cast failed validation outright compiled fifteen zones of homes with no inn in them. The post-condition now runs against the sealed cast. That was a defect, and fixing it does not make a settlement varied; everything above still wants doing.

### W8. The swamp biome — settlements on platforms *(new — maintainer ruling, 2026-08-24)*

**What:** a theme whose settlements are **built over the water**. Not a village beside a marsh — a village *on* it: walkways between stilted houses, a plaza that is a deck, ground that is only ground in patches. It is the first theme whose defining feature is structural rather than cosmetic, and that is the whole reason it is worth building: cozy-village and sci-fi-colony are the same town in two palettes, and this one would not be.

**Its foundation shipped by accident in 0.12, and the maintainer blessed the accident.** The bridge ruling made road-over-water a **walkable tile treatment**: where a road runs through a water rect, those tiles are laid as bridge and the water takes the rest. The immediate consequence in a settlement is a pond that decks a plaza with planks — and the ruling on that was explicit: **it is a desirable direction, never a hazard, and no guard is to be added against settlement bridge tiles.** A swamp biome is what that edge looks like when it is the norm instead of the exception, so the tile, its two art tiers, and the paint-order discipline behind it are already in the tree.

**Hygiene a THIRD theme needs first, and it is the concrete part of this entry.** Every one of these is a latent defect that only fires when a theme that is not one of the two shipped ones exists — which is why they are listed here rather than filed as bugs nobody can reproduce:

- **The legacy role book skips an unlisted theme silently.** `LEGACY_ROLES[theme] ?? {}` in the parity assertion means a theme with no role table asserts *nothing* rather than failing, so the exact bug class the assertion was written to catch — the legacy layout and the default brief calling the same person two different things — comes straight back with theme 3. The `|| LEGACY_ROLES["cozy-village"]` fallback in `buildLegacy` is the other half: an unlisted theme gets the valley's roles and no complaint. **And the harness's own parity loops hardcode the two theme ids** rather than reading `PF.art.themeIds()`, so a third theme would not be swept even if the tables were right.
- **`buildLegacy` still paints its water with a raw fill, not `waterFill`.** The legacy pond, the legacy stream and the compiled wilds stream lay `water` directly; only the feature placer decks bridges. Fine while water-under-structure is an edge case, wrong the moment it is the norm. Unify before, not during.
- **Both bridge painters hard-reference the base water painter.** The Tier-0 painter and the Tier-1 art generator each draw `PAINTERS.water` and then deck over it, which is exactly right today because no theme overrides that painter — sci-fi recolours water through the palette. A theme that overrides the *painter* gets a deck whose one-pixel margin is a different water from the tiles around it, and that margin is the thing that makes a run of them read as a boardwalk.
- **`ROAD_GROUND` membership is unpinned.** The set is `path` and `dirt` — deliberately not `stone`, because paving is also a footprint, a workyard and a ward square. Nothing asserts it, so a theme that lays its roads with a third ground id quietly gets no bridges at all.

**Pillar:** world variety. **Secondary tags:** world coherence, RP frame variety. **Unlocks:** a settlement silhouette the compiler has never produced; a real consumer for `surround` beyond prose; W1's boat as transport rather than flavour. **Depends on:** the hygiene above, in full; W5's place-kinds read differently over water and should be checked rather than assumed. **Companion:** decide what an interior is when the ground floor is a deck — 0.8's floor machinery is the obvious lever and this is the theme that would bend it.

### W9. A "modern" theme *(implied, unscheduled)*

**What:** a present-day theme beside the valley and the colony. It is recorded here **because the maintainer's own language keeps assuming it** — P11's smart device is written for "modern and sci-fi", S4's consumable modifiers name coffee beside bait, and L4's locked doors were argued as effortless in a modern read. Nothing has scheduled it and nothing is designing it; this entry exists so that the theme list's future growth is on the record rather than being rediscovered by a fourth item that needs it.

**Pillar:** world variety. **Secondary tag:** RP frame variety. **Depends on:** exactly the third-theme hygiene enumerated in W8 — the two items share that prerequisite entirely, and whichever lands first pays for both.

---

## E — The cast

### E1. Generic dialogue and the offline content pack *(old 1 — expanded by Ruling 1)*

**What:** canned dialogue generated at creation — now co-generated with P4's quest templates as **one offline content pack**, because they are the same problem: authored-once content that plays without calls.

**Pillar:** Call economy. **Companions:** (i) **state-indexed, not flat** — lines keyed by daypart × location-handle × weather read as a living town; a flat pool reads as canned within five presses, and the creation call writes the matrix as cheaply as the pool; (ii) **the escalation seam** — one pre-written line per NPC gestures at the `situation` ("You heard about the mill, then?"), and pressing E again on it triggers the real LLM call: canned dialogue as a funnel *into* expensive content, not a wall in front of it; (iii) **two registers** (stranger/friend) so P2 has something to switch between; (iv) **overheard lines** — walking past two NPCs yields an ambient snippet; free rumor delivery, and quest hooks can ride it. **Depends on:** nothing to start; P2/L2 enrich the index.

### E2. Algorithmic NPCs and field promotion *(old 2 — the filler half shipped in 0.10)*

**What:** algorithmic filler cast, with special cases (fantasy races, story characters, flagged recruits) getting real generation. **The filler half shipped in 0.10:** the compiler mints residents — themed names, kinds from the quiet buckets (folk, child, healer, scholar), schedules, beds, an empty persona — to fill the rank's population, deterministically from the seed so the mint never touches the save. Companion (ii) came with it: a minted household shares one family surname, so the filler coheres into families as promised.

**Pillar:** Call economy. **What remains:** real generation for the special cases, and companion (i) **runtime field promotion** — an algorithmic NPC the player keeps returning to earns a real persona-generation call on the spot; the bland/real split becomes responsive to play instead of fixed at creation. The mint raised the stakes on this item rather than lowering them: the sealed cast is now a minority of the town (a city runs ~120 souls, most of them minted with an empty persona), so what a minted resident says at the E key is most presses, not a corner case — see Open Questions. **Depends on:** P2's met/talk counts provide the promotion trigger.

### E3. The kind vocabulary split *(old 11 — brief schema v2)*

**What:** `kind` conflates what someone DOES with what someone IS. Split: **trade** (does → building, schedule column), **life-stage** (is — `child` is currently a *kind*, the conflation at its silliest), and consider **`agenda`** — one machine-readable want (tend/sell/watch/court/scheme/mourn/study).

**Pillar:** substrate for the cast items. **Why now-ish:** the enum is being re-cut anyway; cut it for the systems that are *coming* so the migration happens once — schedules flavor placement with agenda, hails (L5) draw approach reasons from it, the GM gets a want-verb in the header, W5's mourners and pupils get their hook. **Depends on:** nothing, but sequence *before* E6 and W5 so briefVersion bumps once, not three times.

### E4. Recruits and followers *(old 5)*

**What:** specially-flagged recruitable NPCs among a deliberately bland majority.

**Pillar:** Progression (social). **Companions:** **follower mode plus a visible hole** — a recruit walks behind you across zones and appears in the header ("traveling with Wren"), and their stall stands unmanned afterward (one S1 flag). Presence at your side, absence at their post: recruitment visible in both directions or it isn't real. Rapport thresholds (P2) decide *when* recruitment opens; hails (L5) give recruits their approach vector. **Depends on:** P2; S1 for the hole; L1 makes following look right.

### E5. Sidekick mode *(old 6)*

**What:** playing as the sidekick rather than the protagonist.

**Pillar:** RP frame variety. **Companion — the actual feature:** **the protagonist as a scheduled NPC** with an agenda (E3) the GM can steer via S1, and hails (L5) so *they* fetch *you*. Without that, sidekick mode is a pronoun swap in the system prompt. **Depends on:** S1, L5, E3.

### E6. Ties — kinship, beds, disclosure *(old 14)*

**What:** relationship data deciding who sleeps where — a married couple shares a double bed. Brief-side: a small `ties` vocabulary (spouse/parent/sibling/rival, by cast reference) — the LLM authors ties, the algorithm derives beds, exactly the house covenant.

**0.10 moved the ground under this item, three ways.** (i) Most households are now compiler-minted and never appear in the brief, so LLM-authored `ties` can only ever cover the sealed cast — minted couples need algorithmic ties or no double beds, and that choice belongs in the schema-v2 conversation (see Open Questions). (ii) An address can hold several households (round-robin over-subscription) and a merged tenement keeps the plain shell, so "who sleeps where" is no longer one household per roof. (iii) The interior sizer and `layoutSleeping` deliberately share one rooms-from-sleepers formula written in two places, agreeing or throwing — a double bed changes that arithmetic, and a tie-aware bed plan must move both ends together.

**Pillar:** world coherence; substrate for social play. **Companion:** **disclosure** — if the graph exists only for bed placement it is the most expensive furniture algorithm ever written. The same data injects one line when relevant ("Maren is Alder's wife"), shapes E1's canned dialogue, and shares its shape with P2 so player-relations and NPC-relations are one system with two edge types. **Depends on:** E3's schema-v2 window (one migration); 0.10's bedroom machinery.

### E7. The `Ask` tree — generic dialogue comes off the narration channel *(new — maintainer design, playtest 2, 2026-08-24)*

**What:** the maintainer's design, recorded as given. Generic NPC dialogue should be **mostly separate from Narration**. Pressing E on somebody opens an **`Ask` tree** — name, occupation, where they are from, what they make, local rumors, what they think of the place — answered package-side and costing no GM turn. It converges with the GM in exactly two cases: when the NPC is **questline-relevant**, and when the **player writes their own** action or line, which is a special choice that cues the GM to answer *as that NPC*.

**Why this is a channel item and not more content.** Today the E key has one behaviour: it spends a GM turn on "I walk up to X and greet them", and the entire town shares it. The only other place a named character speaks is the GM's own dialogue and its overhead bubbles — the SIDE-tagged lines the narrator writes and the surface floats over sprites — so every register from "what's your name" to "will you help me break into the mill" arrives down one pipe, at one price, at one length. That is what makes a hundred and twenty minted residents unaskable (Open Question 11) and it is why walking past somebody is more informative than talking to them.

**Pillar:** Call economy — this is the biggest single item under that pillar, because it takes the most-pressed key in the game off the LLM. **Secondary tags:** world-aliveness, RP frame variety.

**Relationship to E1, said plainly so nobody builds it twice.** E1 owns the *content* — the state-indexed pool, the two registers, the escalation seam, generated once at creation. E7 owns the *shape*: a tree with named branches the player chooses, rather than a line the package emits at a keypress. They want each other — a tree with nothing in it is a menu of silences, and a pool with no tree is the flat pool E1 already warns reads as canned in five presses — and E1's **escalation seam is exactly E7's convergence point**: "press E again on the line that gestures at the `situation`" and "a special choice that cues the GM to answer as this NPC" are the same door described from two sides. Build the seam once.

**Unlocks:** Open Question 11 gets an answer that scales (a minted resident has a name, kind, household, schedule and bed — which is four `Ask` branches without a single generated word); P2's disposition gets somewhere to *show* (branches that open with rapport, L4's doors in conversation form); L5's hails get a shape to arrive in; E4's recruitment gets a place to be offered. **Depends on:** nothing hard to start — the smallest honest first cut is name/occupation/home answered from the compiled NPC record. Richer with E1's pack, P2's registers, and E3's `agenda`. **Companion, and it is the whole risk:** the tree must never become the *only* channel. The reason to talk to somebody in this game is that a narrator is listening; an `Ask` menu that swallows the door to the GM would trade the game's best feature for its cheapest one. The convergence cases are load-bearing, not garnish.

**Down payment shipped in 0.11, and it is a stopgap:** Talk now asks before it spends unread narration ("Skip story & talk?"), because a greeting was silently ending the turn the player was still reading. That is a guard on the single pipe, not a second pipe. E7 is what makes it unnecessary.

---

## Sequencing

**The load-bearing items and what they gate** (S4 joins them per Ruling 2; S5 was promoted out of the open questions):

1. **S1 write-back** — gates consequence everywhere: old 16, quest outcomes, construction, recruit holes, GM hails, disposition bumps. Has the only hard external dependency (engine channel) — *open that conversation first regardless of ship order.*
2. **S2 Inspect/Use** — gates the rest of the action layer, the quest board, and enterables. *(Still open. It was slotted for 0.11 and did not ship; 0.12's fishing routed around it with a proximity button and spent the feature-name consumer on the way past — see S2.)*
3. **S3 pouch + S4 skills/tools** — gate actions' yields, quest rewards, keys, gifts, the economy loop. *(Both shipped — S3 in 0.11, S4 in 0.12 — and the gate held: P3's fishing consumed them the release after, unmodified.)*
4. **S5 player state block** — gates everything that has to survive a reload: S3, S4, P2, P4, P5, W2. Not a dependency so much as a decision that must be made *before* the first thing that needs it, or it gets made badly four times. *(Shipped in 0.11, and 0.12 was the test of it: three consumers landed — skills, equipped tools, the wrap-up marker — and the block took all three additively, with the wire format's pinned literal moving not one byte for two of them.)*

**Updated 2026-08-24, sequencing note.** One maintainer call recorded in the release suggestions, no new items: the quest log (Ruling 1) rides **0.13 with P4** — not a 0.11.x — and 0.12's P5 ledger buffer gains a readable **journal panel** so the log arrives as a tab of a surface that is already full. Reasoning in the 0.12/0.13 bullets. **The panel duly shipped in 0.12** — one day-grouped list plus a notice band — so what 0.13 inherits is a live surface to add a tab to, exactly as the call intended. Note that **the log is now the SECOND tab that surface owes**: P8's extended character view is the other, and the two should be designed as a tab strip once rather than as two one-offs.

**The independent cheap track: L2 weather/calendar** — gates nothing, gated by nothing, pure function of the saved clock, zero save fields, immediate felt difference. The dessert; don't let it displace the substrate, don't let it wait a year either. **It has now been passed over twice** (0.11 slipped it, 0.12 held it deliberately so it could land whole), and the 2026-08-24 amendment made it less cheap than the label says — biasing NPC schedules by the weather is settlement work, not a tint. Re-read L2 before scheduling it against the old estimate.

**Releases, as they actually landed and as they are suggested from here:**

- **0.11 — shipped: S5 + S3 + P1's field** (see the history table). **S2 and L2 were in the suggestion and are not in the release**, which is worth saying rather than quietly re-listing them: the save block plus the pouch plus the loading gate was the whole of it, and the second verb and the weather both slipped whole.
- **0.12 — in progress: S4 + P3's fishing vertical + P5, plus the bridge.** S4's ladder and skills, fishing with all four parts of P3's stack (target, yield, receipt, modifier), P5's Sleep + two-field flush + journal panel, and — falling out of the water the verb needed — the **bridge tile treatment** that lets a road cross a water rect instead of refusing the placement, which is what finally puts a `water-feature` in the wilds. Plus the **character sheet**, which is P8's seam shipped as a working panel. **L2 does NOT ride** (maintainer ruling): daypart is the only live modifier and the weather column is built and empty.
- **0.13** — P4 quests + E1 offline content pack (one generation batch) + the quest board: the lean-play mode complete. **The quest log ships here as a tab (or filter) of 0.12's journal panel**, not as a new surface — quests land in a pane that has already earned its place. Deliberately NOT earlier: a quest log before P4 renders an empty list (nothing populates `quests.active` until the templates exist, and nothing verifies an objective until P3/S4 give the package things to count) — the same decoration-before-behavior rule that deferred room purposes in 0.8. And it stays the *mechanical* log per Ruling 1's surviving design rule: quest state binds tiles and tables, never the GM's prose — capturing GM-narrated questlines is S1/P7 territory and its own future conversation.
- **S1 lands whenever the engine channel does** — slot its first consumers (shelter, boarded door) into whichever release that is.

---

## Will not build

Kept deliberately, so old bad ideas are not re-litigated every few months. **Attribution matters here:** entries citing a Ruling are maintainer-settled; the rest are the package author's argued positions, and they yield to a maintainer's word — a future contributor should treat them as challengeable, not as doctrine. The quest log has been **removed from this list by Ruling 1** (2026-08-21); what survives of the old objection is the design rule in P4 — quest state binds tiles and tables, never the GM's prose.

- **Reflex minigames for actions** (timing bars, skill checks). Refusal upheld by Ruling 2, replacement specified: RNG tables with skill and equipment inputs (S4 + P3). Stardew built reflex layers because it has no narrator; this game has one, and a reflex gate between the player and the GM's line imports a solution to a problem Pixelforge doesn't have.
- **A free-form building-placement editor.** Fights the package identity at the root: the compiler owns geometry, and the seed/save/determinism covenant depends on it. Upgrading is *choosing between compiled variants* (a flag picks the bigger forge), never dragging tiles. Player expression, if the itch persists, spends itself on the player home's interior — one zone, contained blast radius.
- **Invisible simulations** — NPC hunger/energy needs, price-finding markets, supply chains. The schedule table already fakes the visible fraction of a needs sim at a hundredth of the cost; the GM narrates trade better than a sim prices it. Note the quest/skill layer does **not** reopen this: rewards and shop stock are fixed table-driven values, not market-driven ones.
- **Package-side combat.** Maintainer-settled in substance: the engine owns combat, the package hands off and freezes (the shipped design), and the maintainer's long-held combat plans — pokémon-style and turn-based V20/5e modes — are an engine-side track, deliberately held, not a package feature. The moment Pixelforge owns combat it owns balance, and balance is a second game.
- **Audio — for now.** Not wrong, just polish before structure. A day/night ambience layer is worth one afternoon someday, and no more than that yet.

---

## Open questions

Flagged so a future session doesn't rediscover them the hard way.

1. **The S1 channel's shape.** Custom tool call? Tracker/state-patch? A capability-API addition? This is an *engine* conversation and the roadmap's only hard external dependency. Decide the vocabulary's size cap and the validation story (flags are untrusted model output — same repair discipline as the brief).
2. **The player block's shape** *(the "whether" is settled — see S5, and so is the migration policy: migrate on read, own nested version, unknown keys preserved. This is what remains)*. Open: whether quest state stores completions only or full in-progress objectives; whether the relationship ledger's "last thing between you" line is worth its bytes; and how discovery state keys sub-zones so a re-seeded world does not resurrect a place that no longer compiles.
3. **Brief schema v2 timing.** E3 (kind split, agenda), E6 (ties), and possibly W4 (specialization) all want brief changes — and 0.10 already made one without a bump: `backgroundPopulation` stopped being pure narrative texture and became the `householdTarget` input `20-world.js` reads, moving minted residents, dwellings and doors within the rank's band (it cannot change the rank, nor the guest wing, which is keyed on scale + prosperity). That is a MEANING change under the §1 rule. It went unbumped deliberately, because nothing reads `briefVersion` and the bundle below had not opened. Bundle them all into one `briefVersion` bump with one migration, and decide what happens to sealed v1 briefs (presumably: compile exactly as today — the 0.8 elder precedent), including whether a v1 brief's `backgroundPopulation` keeps leaning the mint or is ignored.
4. **Travel keys vs. forced questing.** W1's "by quest" key must never conscript slice-of-life players — codified in P4 as multiple-keys, but each gate's key *set* is a design decision per gate type. Who decides — brief, theme, or wizard?
5. **Skill/XP visibility.** Numbers on screen serve the grind audience; diegetic prose ("your casts feel surer") serves the RP audience. Both? A HUD toggle? Decide before S4 ships, not after. *(0.12 answered it in practice and not in principle: a level change is toasted the moment it happens and the level then lives on the character sheet, while the xp behind it is sheet-only — so the one number that reaches a player who never opens a panel is the level, on the cast that earned it. That is a defensible default and not the full answer — nothing yet writes the diegetic register, and P8's ruleset descriptors are where a "prose spread" would live if anybody wants one.)*
6. **Combat-shaped quests.** Offline resolution can't cover them (combat is the engine's, and its cost is the GM's). Defer, or let them exist as board entries that *route into* normal GM play rather than offline resolution?
7. ~~**The wrap-up's turn cost.**~~ **Answered by 0.12: prefixed to the next player-initiated turn.** Sleep sends nothing at all — it moves the clock and leaves a marker — and the wrap-up rides whichever turn the player sends next for their own reasons, burning on accept like every other one-shot. So sleeping is free and the summary is a passenger. The residual the old question named is real and accepted rather than solved: a player who sleeps and never sends another turn strands the ledger, and so does a player who never sleeps (P5's two never-flush classes, which **P10** is the fix for).
8. **Host weather vs. package weather.** The engine has host-side time/weather; the package deliberately owns its clock and should own its weather for the same reason — but the header word is the only synchronization. Is that enough, or does a host-weather chat need a reconcile rule?
9. **Where the player home comes from.** Compiler-minted always? Wizard-declared? Does the player join a `household` (id space exists) — and does a lodger-at-the-inn start read better for transient story frames?
10. **The offline content pack's budget.** E1 + P4 generate at creation in one call; the sealed brief has an 8 KB budget with truncation order. The pack is bigger than the brief — separate sealed blob with its own budget and its own salvage rules, presumably. Decide before writing the generation guidance.
11. **What a minted resident is at the E key** *(raised by 0.10's population mint)*. The sealed cast is now a minority: a city runs ~120 souls and most are minted with an empty persona. A minted resident has a name, kind, household, schedule and bed — everything but something to say. Do they ride the sealed cast's persona machinery, wait for E1's canned pool, hold for E2's field promotion, or a ladder of all three? Decide before E1's content pack is generated: its index needs to know whether it is writing for ten people or a hundred and twenty.
12. **Ties for the minted majority** *(raised by 0.10, lands on E6)*. The `ties` vocabulary is LLM-authored over the sealed cast, and the mint now creates most households — deterministically, at compile, where no LLM is present. Algorithmic ties for minted households (two adults sharing a surname and a roof are probably a couple), or no double beds outside the cast? Fold the answer into the one schema-v2 window (question 3) so beds are derived once.
13. **Widgets: integrate or suppress** *(S7 — a maintainer decision, not an open design)*. Suppress at setup, render them honestly as the engine's, or map the money-like ones onto package state. The three do not compose and the third is the one that quietly creates two writers for one number. **Pairs with 14** — decide them together or the answers contradict.
14. **Narrated transactions: prompt contract, or real verbs** *(P7)*. Tell the GM to narrate around the ledger and never move it, or hand it `rentBerth`/`grant`/`take`/`award` as actions it can actually call. The first is available today and holds most turns; the second is S1's channel wearing an economy hat and inherits the rewind contract for free. Until one of them lands, the mechanical verbs are the only real economy and the roadmap should keep saying so.
15. **Does the sim clock pause while the GM writes?** *(raised by playtest 2, lands on L6's amendment)*. Real seconds pass during generation and the package converts them, so a slow turn ages the town by the length of the wait. `30-sim.js` already freezes the clock in dialogue for the same reason — a conversation must not burn the afternoon — and `isStreaming` is already on the props, so the signal is free. What wants deciding is whether NPC wander pauses with it (in dialogue it deliberately does not: the world stays alive while you read) and what a paused clock does to `_clockAcc` across a chat switch.

---

*Prepared 2026-08-21 from the design brief of the same date and three maintainer rulings, against source at `packages/pixelforge`; revised 2026-08-25 against the 0.12 tree (0.10 and 0.11 merged; 0.12 in progress). The through-line, one sentence: Pixelforge built a beautiful one-way radio — the world describes itself to the narrator every turn and can't hear anything back — and almost everything stubbed on this roadmap is stubbed because one of the two missing directions (GM→world, player→world) hasn't been opened yet.*
