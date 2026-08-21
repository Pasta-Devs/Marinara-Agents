# Pixelforge Roadmap

**Revised 2026-08-21.** This replaces the flat 19-item discovery-order list. It folds in the design brief of the same date (missing pillars, new features, and per-item companions) and three maintainer rulings, recorded below so they are never re-litigated by accident. The old numbers survive as aliases — see the index — but the flat list itself is retired.

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
| **0.10** | **Next release, in progress.** Interior building zoning: wings-and-spine partitioner, size-follows-program interiors, and the full room vocabulary (bedroom, kitchen, bath, workroom, dining, storage, shopfloor, taproom, nave, council, quarters, guestroom, dormitory, unit, reception, privy, stable, washhouse, study, loft, porch). *(Old item 13 — its "deferred decoration" description is retired; this is a release, not a nice-to-have. Its runtime companion is L3.)* |

---

## Rulings absorbed (2026-08-21) — do not re-litigate

**Ruling 1 — the structured quest log is IN.** The earlier design brief argued the transcript is the journal and the GM makes a quest engine redundant. **Overruled**, and the reasoning matters: Pixelforge is to be *both* an RPG and an AI RP experience, and some players will want to grind generic quests for money, experience, and rapport **while being lean with AI calls**. The old analysis missed that a quest system is also a way to *play without spending GM calls* — a real need this package had no answer to. Design constraints from the ruling: the GM is kept aware at a **wrap-up boundary** (sleep summarizes the day to the narrator), not per-step; questing skews fantasy/sci-fi and a slice-of-life player may never touch it, **and it must never be forced** — opt-in or naturally ignorable, never a spine. This ruling adds a sixth pillar (below) and is embodied in items P4, P5, S4, and the revised E1. What it made *more* valuable: the pouch (money), the relationship ledger (rapport), the offline dialogue pack (same generation problem), the player home (the sleep boundary needs a bed), and the quest board. What it made redundant: nothing — only the refusal itself.

**Ruling 2 — no reflex minigames for fishing; RNG with inputs instead.** The refusal of timing-bar minigames stands, but the replacement is specified: **RNG-based, with skill level and rod/bait quality affecting what can be caught and the success rate.** A probability table with player-side inputs, not a bare progress bar. This quietly introduces two things that existed nowhere in the package — **equipment quality** and **improvable skill levels** — which are deliberately split out as their own substrate item (S4) because every time-passing action, the quest layer, and the economy all consume them.

**Ruling 3 — everything in the 2026-08-21 brief enters the roadmap.** Nothing dropped for being speculative.

---

## The pillars

The gaps the roadmap exists to close, in order of how much they matter for *this* game. Every item below carries a pillar tag.

1. **Consequence** — the world never registers the story. The GM narrates a fire; the barn stands forever. The narration→world direction does not exist (its one beachhead: the `_hold` seam in `resolveSchedules()`).
2. **The second verb** — Talk is the only content verb; the entire map is scenery. The schema has reserved feature-name "inspect text" since 0.4 (§9) with no verb to consume it.
3. **Things** — no items, money, or ownership. Connective tissue for every action system.
4. **The unknown** — everything exists at boot; travel is a dropdown. Exploration needs destinations that *don't exist yet*.
5. **Progression** — social progression (rapport, reputation) first; and — revised per Ruling 1 — **light mechanical progression** (skills, tools, money) as the lean-play track. The earlier claim that XP doesn't matter here was half wrong: it doesn't matter *as a substitute for the narrator*, but it does matter as a way to play beside the narrator.
6. **Call economy** *(new, named by Ruling 1)* — content that plays without spending LLM calls: canned dialogue, offline quests, deterministic weather. The header-and-injection discipline was already serving this pillar unnamed.

**Secondary tags.** Items below also carry lighter tags that are not pillars — they describe a quality an item serves rather than a gap it closes. The full set, so filtering stays consistent: **soft stakes** (closed doors, missed people, weather — the only grade of risk this game needs), **time-meaning** (the clock should be a decision, not a toll), **world-aliveness**, **world agency**, **world variety**, **world coherence**, **ownership**, **RP frame variety**, and **legibility**. A secondary tag never substitutes for a pillar; an item with only a secondary tag is polish, and should be read as such when sequencing.

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

These five gate more of the roadmap than everything else combined. Marked **LOAD-BEARING** with what each gates.

### S1. The GM write-back channel — LOAD-BEARING

**What:** a bounded, closed vocabulary of world-state flags the GM can set through a structured side-channel (the package already consumes host signals; this is the reverse lane): `closed:<zone>`, `damaged:<zone>`, `shelter:<zone>`, `hold:<npc>@<zone>`, `gone:<npc>`, `hail:<npc>`. Flags select from **pre-built variants** — soot tint plus the existing roof-stripping, a boarded door, a nave re-laid with the existing `dormitory()`. The founding rule extended in time: *the LLM decides what happened; the algorithm decides how it looks.* The model never gains geometry authority.

**Pillar:** Consequence. **Unlocks / gates:** old item 16 (refugees/tents become *one flag* plus a tent placer — build the mechanism, not the bespoke feature), quest outcomes with visible results, construction states (P6), the recruit's unmanned stall (E4), GM-driven hails (L5), disposition bumps (P2), protagonist steering (E5). **Depends on:** an engine-side structured GM-output channel — the one hard external dependency on this roadmap; start that conversation before anything else even if S1 ships later. **And a reload contract:** flags mutate the world, which `simFromSaved` rebuilds from the seed, so without one every consequence dies at the next load — see S5 for the three options, and pick one before shipping this. **Companion:** its first two consumers (shelter re-lay, boarded door) should ship *with* it so the channel is never live and invisible.

### S2. Inspect / Use — the second verb — LOAD-BEARING

**What:** extend E-targeting beyond NPCs to features, signs, doors, furniture. Two grades matching the clock covenant: **Inspect is free** (talk-shaped — `[Player examines The Long Furrows (crop-plots)]`, the GM riffs), **Use costs time** (the trigger surface for every P3 action).

**Pillar:** The second verb. **Unlocks / gates:** all of P3 (actions need a trigger), W2 (enterables need a door handle), P4 (the quest board is an inspectable), the pouch's front door, and the §9 feature-name consumer. The whole existing map — every placer output, every 0.10 room's furniture — becomes content overnight. **Depends on:** nothing. Cheapest high-leverage item in the document. **Companion:** a once-per-feature flavor injection using the existing zone-flavor metering, so first touches land prose without recurring cost.

### S3. The pouch — items and money — LOAD-BEARING

**What:** minimal player inventory — a list of `{tag, name, qty, quality?}` plus a money integer. Deliberately not an economy: no prices discovering themselves, no markets clearing.

**Pillar:** Things; Call economy (quest rewards). **Unlocks / gates:** P3 yields (a fish that exists), P4 rewards (money), S4 (tools live here), keys (L4), gifts (P2), P6 resources, and shops that finally *sell* something. **Depends on:** nothing. **Companion:** stock the existing shop counters with three buyable things per theme at fixed prices, so money has a sink the day it exists.

### S4. Skills and tools — LOAD-BEARING *(new — from Ruling 2)*

**What:** the shared progression substrate Ruling 2 implies. **Skills:** a small fixed vocabulary aligned to the action verbs (fishing, foraging, mining, crafting — extend only with new verbs), leveling with use and with quest XP; levels shift the RNG tables. **Tools:** items with a quality tier (crude/decent/fine/masterwork, theme-skinned) plus consumable modifiers (bait, charge cells, coffee). Split out as its own item — not folded into fishing — because *every* time-passing action reads it, quests pay into it, and the economy sells it.

**Pillar:** Progression (mechanical); Call economy. **Unlocks / gates:** the specified fishing model (P3), the quest XP loop (P4), the money sink that makes P6's economy circulate (better rod costs money; crafting makes better rods). **Depends on:** S3. **Companion:** visibility policy decided up front (see Open Questions — numbers on screen vs. diegetic prose), so the RP half of the audience never sees a spreadsheet they didn't ask for.

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

**Companion — the rehydration order, which is not obvious and is easy to get wrong.** The block must be restored **after** `PF.world.build` and **before** `saved.zone` resolves. World-derived ids (a discovered sub-zone, a bed, a workplace binding) do not exist until the compile has run, and the restore path already lands the player at spawn for an id it cannot resolve — so a block rehydrated too late is a block whose references are silently dropped, and one rehydrated too early points at nothing.

**Depends on:** nothing technically; it is a decision, not a dependency. Sequence it **with or before its first consumer** — which under the suggested plan is S3 in 0.11. **Do not let the first consumer define the schema by accident.**

---

## L — The living settlement

### L1. NPCs walk *(old 12)*

**What:** pathfinding between schedule anchors instead of the daypart teleport. Trivial at these scales (A\* on ≤96×72); the two-pass relocation machinery already solved the hard correctness problem — walking is a path between the same answers.

**Pillar:** world-aliveness. **Companions that make it real rather than animation:** (i) **interception** — an NPC en route is talkable, and the header says "headed to the smithy," one token of pure GM fuel derived from state already held; (ii) **doors** — walkers visibly use them (door tiles are already non-solid and schedule-excluded); an NPC melting through a wall undoes the feature; (iii) **staggered departures** — hash-offset leave times ±20 minutes so the town doesn't move as one organism at 07:00. **Depends on:** nothing; cross-zone relocation machinery exists. **Unlocks:** hails (L5) get literal path-crossings.

### L2. Weather and the calendar

**What:** weather as a **pure function of (seed, day, clockMin)** — the same trick schedules pull; zero save fields, rewind-safe. Rain tint and particles, snow ground-swap, storms. On top: a calendar — `day % 7` gives a week; market day fills the plaza with the existing stall placer; one assembly/sabbath/game-night day per theme.

**Pillar:** time-meaning; Call economy (fully deterministic content). **Unlocks:** a load-bearing header token ("rainy dusk" writes half the scene), schedule modifiers (storm empties the plaza, fills the inn — the town visibly answers the sky), P3 modifiers (fish bite in rain — the clock becomes a decision), a reason to `waitUntil`, W4's calendar hooks (shift-change day, pilgrimage day). **Depends on:** nothing. The best cheap win on the roadmap. **Note:** stays package-local like the clock; the header word keeps the GM consistent (see Open Questions re host weather).

### L3. Room-grain schedules and occupancy *(runtime companion to 0.10)*

**What:** grow the schedule handle vocabulary to room grain — hearth, workbench, table, bed — so 0.10's named rooms have occupants at the hours players open doors: dinner in the dining room, the scholar in the study. The schedule module already learned this lesson once (the keeper tier exists because the church was empty exactly when players entered); apply it to rooms.

**Pillar:** world-aliveness. **Unlocks:** room names in the dialogue header ("in the kitchen of the Wet Boot") — free spatial specificity for the GM; S2's richest inspect targets (0.10 furniture should land pre-tagged). **Depends on:** 0.10.

### L4. Hours and locked doors

**What:** doors lock by schedule — shops close at night, homes close to strangers. A locked door is a toast and a GM line ("you could knock"), never a hard wall.

**Pillar:** soft stakes. **Unlocks:** night becomes a different place rather than a darker one; rapport gets its mechanical payoff (friendship literally opens doors — P2); keys become the first meaningful item (S3); trespass becomes an expressible story the GM can react to. Modern read is effortless (keycards, closing time). **Depends on:** basic version nothing; the good version reads P2.

### L5. Hails — NPCs who start it

**What:** rate-limited, deterministic NPC-initiated contact: a bubble ("Alder waves you over"); answering opens dialogue with a prefix saying *they* initiated and why (persona + situation + disposition).

**Pillar:** world agency. **Unlocks:** personas pay off without the player grinding every door; S1 gains a queueable "have X approach the player" op — the single most useful GM request available; recruits (E4) get their approach vector; quest-givers (P4) can flag you down about the job. **Depends on:** nothing hard; better with P2 and L1.

---

## P — The player's stake

### P1. The player home

**What:** the player currently has no bed, door, or tile of their own. Mint one dwelling (the machinery all exists), or place the player as a lodger at the inn via the wizard.

**Pillar:** ownership. **Unlocks:** `waitUntil("dawn")` becomes *sleeping in your bed*; **the P5 wrap-up boundary gets its trigger**; storage gives items a place to live; P6 gets its first and most-motivating upgrade target; the GM gets a persistent "home" anchor. Four payoffs, one lot. **Depends on:** nothing. Ruling 1 raised this item's priority: the quest layer's day boundary is a bed.

### P2. The relationship ledger

**What:** per-NPC player-facing state: `met` (the persona one-shot flag already half-is this), a five-step disposition (stranger/acquainted/friendly/close/hostile), optionally one line of "last thing between you." Surfaced in the per-turn header — `near: Alder Vance (hedge-mayor, friendly)`. Bumped heuristically (talk count, gifts, **completed quests for the giver** — Ruling 1's "rapport") and precisely via S1.

**Pillar:** Progression (social) — and it fattens the *persistent* GM channel, where this architecture keeps its truth once one-shots burn. **Unlocks:** recruitment thresholds (E4), door access (L4), the data shape E6 shares, social memory at 400-turn horizons, quest rapport rewards. **Depends on:** nothing for the heuristic version; S1 for GM-driven bumps.

### P3. Time-passing actions *(old 10)*

**What:** fishing, mining, foraging, crafting — every one advances the clock (talking stays free; combat's cost stays the GM's). Per Ruling 2, resolution is **RNG tables with inputs**: skill level (S4) and tool/bait quality (S3/S4) set what can be caught and the success rate. No reflex gates.

**Pillar:** the second verb; time-meaning; Call economy (resolves offline). **The full stack, because any one part alone is a stub:** (i) **a target** — the action binds to a named feature via Use (S2), so the GM knows *where*; (ii) **a yield** — the fish exists afterward (S3); (iii) **a receipt** — `[Fished at the Millpond until dusk. Caught: one pale carp.]`, so the narrator can pay off the cost — or, leaner, the line goes to the P5 day ledger instead of spending a turn; (iv) **a modifier** — daypart/weather (L2) affects tables, making the clock a decision. Fold `waitUntil` in: "fish until dusk" as a compound gives actions an intent-sized grain. **Depends on:** S2, S3; S4 for the specified model; L2 for modifiers.

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

### P6. Resources, building, upgrading *(old 8)*

**What:** spend resources and money to build and upgrade.

**Pillar:** ownership; Progression. **Companions:** (i) **the player home first** (P1) — motivation before infrastructure; (ii) **visible construction states** — scaffolding-for-N-days via an S1-style flag overlay; instant completion wastes the clock system; (iii) **source resources from `surround`** — woods→timber, rocky→stone, water→fish, barren→salvage — giving a sealed 0.4 field its first mechanical consumer, the §9 pattern working as designed; (iv) upgrades are **choices between compiled variants**, never tile placement (see Will Not Build). **Depends on:** S3; S1 for construction states; P3 for gathering.

---

## W — The wider world

### W1. Travel gating and vehicles *(old 9)*

**What:** gate travel by quest, vehicle, fee, or rapport — a gate must accept more than one key (see P4's covenant).

**Pillar:** the unknown. **Companions:** **somewhere to go** (W2 — a gate with nothing behind it is a wall) and **the vehicle as a themed feature**: every theme names its vehicle in the placer registry — dock/boat, pad/shuttle, bus-stop/bicycle — one gating system, three skins; sailing generalized. The sailing case lives here: the boat is a travel key *and* a fishing multiplier *and* an exploration verb. **Depends on:** W2 for payoff; S3 for fees/tickets.

### W2. Enterables and the expedition ladder *(old 19 + new)*

**What:** enterable ruins and lookouts — plus the reason to enter: **lazily-compiled sub-zones** chained off wilds edges and enterable features (the cave behind the ruin, deeper woods, a derelict deck below the hull), deterministic from `hash(seed, edgeId, depth)`, compiled on first entry. The unknown *exists without pre-existing*; the sealed brief stays sealed.

**Pillar:** the unknown — the missing half of exploration: destinations that don't exist yet. **Unlocks:** W1 gets something behind the gate; P3's mining/foraging get places that feel earned; sailing gets shores worth landing on. **Companions:** the S2 once-per-feature flavor injection, so first entry always lands prose — and **discovery state**, which needs saying precisely because it is a promise the save format cannot currently keep. A found place staying found is save data, and the snapshot has no discovery field; `simFromSaved` restores none. So either it rides the versioned player block of Open Question 2 (rehydrated after `PF.world.build` and before `saved.zone` resolves), or **discovery is session-only and W2 must say so out loud**. Do not ship the ladder with the stronger promise implied and the weaker behaviour built. **Depends on:** S2; benefits from 0.10's room vocabulary; deliberately sequenced late because its payoff multiplies with what's coming — the one deferral justified by dependency, not art.

### W3. Cities and districts *(old 17 — half shipped)*

**What:** the 96×72 `city` scale shipped in 0.9; what remains is density and **districts with their own gravity** — a ward `public` handle per district (one plaza serving 96×72 is a village in a coat), district market days (L2), district names in the header, and `backgroundPopulation` (a §9 reserved consumer) cashed out as ambient walker density per district.

**Pillar:** world variety. **Depends on:** L2 for district calendars; W6's map surface stops being optional at this scale.

### W4. The specialization axis *(old 15)*

**What:** settlement specialization (mining town, market town, pilgrimage town, college town) as an axis beside scale and prosperity.

**Pillar:** world variety. **Companion — the whole item:** **cascade it through the vocabularies, not just the counts.** Fewer inn beds is bookkeeping nobody sees. One enum value should pick: placers (a mine, a workyard bias, tailings), cast-kind priors (more miners), **a schedule column** (the day shift vanishes underground and the streets visibly empty at 08:00), and **a calendar hook** (shift-change day, market day, holy day). That cascade is what makes one word feel like a different town instead of a different spreadsheet. **Depends on:** L2 for calendar hooks; W5 for the anchor place-kinds.

### W5. Place-kind expansion *(old 18)*

**What:** market, bathhouse, school, infirmary, keep, graveyard, mine, dock, communal residence.

**Pillar:** world variety. **Companion, as a hard rule:** **no new place-kind ships without its schedule column and its calendar hook.** A school without school-hours is a building-shaped rock — and pupils finally give the `child` kind a daytime anchor besides the plaza. Bathhouse peaks at dusk; the graveyard gets mourners; the infirmary is the `healer`'s workplace; the market *is* a calendar day made of stone. The codebase paid for this lesson once already (the keeper tier's empty church). **Depends on:** dock pairs with W1; mine pairs with W4 and P3.

### W6. World reuse and the map surface *(old 3, 4 + new)*

**What:** two small things folded together. (i) **Reuse:** the sealed brief + seed pair already *is* the reusable asset; what's missing is a browse/replay surface — UI, not world-gen. Low urgency. (ii) **The in-game map:** auto-drawn from compiled zones (the data exists), fog-of-war revealing zones/POIs as visited — exploration made legible as visible progress.

**Pillar:** the unknown (legibility). **Depends on:** nothing; becomes load-bearing at city scale (W3) and with expeditions (W2).

---

## E — The cast

### E1. Generic dialogue and the offline content pack *(old 1 — expanded by Ruling 1)*

**What:** canned dialogue generated at creation — now co-generated with P4's quest templates as **one offline content pack**, because they are the same problem: authored-once content that plays without calls.

**Pillar:** Call economy. **Companions:** (i) **state-indexed, not flat** — lines keyed by daypart × location-handle × weather read as a living town; a flat pool reads as canned within five presses, and the creation call writes the matrix as cheaply as the pool; (ii) **the escalation seam** — one pre-written line per NPC gestures at the `situation` ("You heard about the mill, then?"), and pressing E again on it triggers the real LLM call: canned dialogue as a funnel *into* expensive content, not a wall in front of it; (iii) **two registers** (stranger/friend) so P2 has something to switch between; (iv) **overheard lines** — walking past two NPCs yields an ambient snippet; free rumor delivery, and quest hooks can ride it. **Depends on:** nothing to start; P2/L2 enrich the index.

### E2. Algorithmic NPCs and field promotion *(old 2)*

**What:** algorithmic filler cast, with special cases (fantasy races, story characters, flagged recruits) getting real generation.

**Pillar:** Call economy. **Companions:** (i) **runtime field promotion** — an algorithmic NPC the player keeps returning to earns a real persona-generation call on the spot; the bland/real split becomes responsive to play instead of fixed at creation; (ii) **household surnames** — households already share roofs and id numbers; shared names cohere the filler into families for nearly free. **Depends on:** P2's met/talk counts provide the promotion trigger.

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

**Pillar:** world coherence; substrate for social play. **Companion:** **disclosure** — if the graph exists only for bed placement it is the most expensive furniture algorithm ever written. The same data injects one line when relevant ("Maren is Alder's wife"), shapes E1's canned dialogue, and shares its shape with P2 so player-relations and NPC-relations are one system with two edge types. **Depends on:** E3's schema-v2 window (one migration); 0.10's bedroom machinery.

---

## Sequencing

**The load-bearing items and what they gate** (S4 joins them per Ruling 2; S5 was promoted out of the open questions):

1. **S1 write-back** — gates consequence everywhere: old 16, quest outcomes, construction, recruit holes, GM hails, disposition bumps. Has the only hard external dependency (engine channel) — *open that conversation first regardless of ship order.*
2. **S2 Inspect/Use** — gates the entire action layer, the quest board, enterables, and the reserved feature-name consumer.
3. **S3 pouch + S4 skills/tools** — gate actions' yields, quest rewards, keys, gifts, the economy loop.
4. **S5 player state block** — gates everything that has to survive a reload: S3, S4, P2, P4, P5, W2. Not a dependency so much as a decision that must be made *before* the first thing that needs it, or it gets made badly four times.

**The independent cheap track: L2 weather/calendar** — gates nothing, gated by nothing, pure function of the saved clock, zero save fields, immediate felt difference. The dessert; don't let it displace the substrate, don't let it wait a year either.

**Suggested next three releases** (a suggestion, not a commitment):

- **0.11** — **S5** + S2 + S3 + L2 + **P1**: the save block first, then the second verb, things, weather, and a bed; the world becomes touchable. S5 leads because S3 is the first thing that has to persist, and a schema retrofitted around an existing pouch is a migration nobody wanted to write. P1 is not optional here — P5 in 0.12 has no trigger without a bed to sleep in, so slipping it silently strands the release after.
- **0.12** — S4 + P3 (fishing first, per the ruling's specified model) + P5's ledger buffer: the first full action stack.
- **0.13** — P4 quests + E1 offline content pack (one generation batch) + the quest board: the lean-play mode complete.
- **S1 lands whenever the engine channel does** — slot its first consumers (shelter, boarded door) into whichever release that is.

---

## Will not build

Kept deliberately, so old bad ideas are not re-litigated every few months. The quest log has been **removed from this list by Ruling 1** (2026-08-21); what survives of the old objection is the design rule in P4 — quest state binds tiles and tables, never the GM's prose.

- **Reflex minigames for actions** (timing bars, skill checks). Refusal upheld by Ruling 2, replacement specified: RNG tables with skill and equipment inputs (S4 + P3). Stardew built reflex layers because it has no narrator; this game has one, and a reflex gate between the player and the GM's line imports a solution to a problem Pixelforge doesn't have.
- **A free-form building-placement editor.** Fights the package identity at the root: the compiler owns geometry, and the seed/save/determinism covenant depends on it. Upgrading is *choosing between compiled variants* (a flag picks the bigger forge), never dragging tiles. Player expression, if the itch persists, spends itself on the player home's interior — one zone, contained blast radius.
- **Invisible simulations** — NPC hunger/energy needs, price-finding markets, supply chains. The schedule table already fakes the visible fraction of a needs sim at a hundredth of the cost; the GM narrates trade better than a sim prices it. Note the quest/skill layer does **not** reopen this: rewards and shop stock are fixed table-driven values, not market-driven ones.
- **Package-side combat.** The engine owns combat; the package hands off and freezes (already the shipped design). The moment Pixelforge owns combat it owns balance, and balance is a second game.
- **Audio — for now.** Not wrong, just polish before structure. A day/night ambience layer is worth one afternoon someday, and no more than that yet.

---

## Open questions

Flagged so a future session doesn't rediscover them the hard way.

1. **The S1 channel's shape.** Custom tool call? Tracker/state-patch? A capability-API addition? This is an *engine* conversation and the roadmap's only hard external dependency. Decide the vocabulary's size cap and the validation story (flags are untrusted model output — same repair discipline as the brief).
2. **The player block's shape** *(the "whether" is settled — see S5, and so is the migration policy: migrate on read, own nested version, unknown keys preserved. This is what remains)*. Open: whether quest state stores completions only or full in-progress objectives; whether the relationship ledger's "last thing between you" line is worth its bytes; and how discovery state keys sub-zones so a re-seeded world does not resurrect a place that no longer compiles.
3. **Brief schema v2 timing.** E3 (kind split, agenda), E6 (ties), and possibly W4 (specialization) all want brief changes. Bundle them into one `briefVersion` bump with one migration, and decide what happens to sealed v1 briefs (presumably: compile exactly as today — the 0.8 elder precedent).
4. **Travel keys vs. forced questing.** W1's "by quest" key must never conscript slice-of-life players — codified in P4 as multiple-keys, but each gate's key *set* is a design decision per gate type. Who decides — brief, theme, or wizard?
5. **Skill/XP visibility.** Numbers on screen serve the grind audience; diegetic prose ("your casts feel surer") serves the RP audience. Both? A HUD toggle? Decide before S4 ships, not after.
6. **Combat-shaped quests.** Offline resolution can't cover them (combat is the engine's, and its cost is the GM's). Defer, or let them exist as board entries that *route into* normal GM play rather than offline resolution?
7. **The wrap-up's turn cost.** P5 flushes as one injection — on the sleep action's turn, or prefixed to the next player-initiated turn? The injection discipline says burn-on-accept; sleeping without ever talking again should not strand the ledger.
8. **Host weather vs. package weather.** The engine has host-side time/weather; the package deliberately owns its clock and should own its weather for the same reason — but the header word is the only synchronization. Is that enough, or does a host-weather chat need a reconcile rule?
9. **Where the player home comes from.** Compiler-minted always? Wizard-declared? Does the player join a `household` (id space exists) — and does a lodger-at-the-inn start read better for transient story frames?
10. **The offline content pack's budget.** E1 + P4 generate at creation in one call; the sealed brief has an 8 KB budget with truncation order. The pack is bigger than the brief — separate sealed blob with its own budget and its own salvage rules, presumably. Decide before writing the generation guidance.

---

*Prepared 2026-08-21 from the design brief of the same date and three maintainer rulings, against source at `packages/pixelforge` (0.9 in PR; 0.10 in progress). The through-line, one sentence: Pixelforge built a beautiful one-way radio — the world describes itself to the narrator every turn and can't hear anything back — and almost everything stubbed on this roadmap is stubbed because one of the two missing directions (GM→world, player→world) hasn't been opened yet.*
