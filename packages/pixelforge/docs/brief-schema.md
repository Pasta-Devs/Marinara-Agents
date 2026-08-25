# The World Brief — schema v1 (sealed spec)

**Architecture:** the LLM decides _what exists_, the algorithm decides _where every tile goes._
One structured call at game creation (engine #5135, route
`POST /api/game/:chatId/experience-generation`) turns the wizard's preferences into a compact
**brief**; a deterministic compiler builds the tile world from `compile(brief, seed)` forever
after. This document is the contract between them.

Synthesized from a three-draft adversarial panel (minimal-enum × repair-first base, judged by a
cost skeptic and the compiler author). Design rule inherited from the product discussion: **the form
does the teaching** — the model fills vocabularies and bounded lists; free text exists only where a
named consumer in shipped code reads it, and no field the model writes can become geometry except
through the derivations below.

---

## 1. The schema

```js
{
  briefVersion: 1,          // int. Bumped only when a field's MEANING changes — but nothing
                            // reads it yet, so a bump is bookkeeping for a migration that does
                            // not exist. 0.10 changed `backgroundPopulation`'s meaning and did
                            // NOT bump: the number moves once, when the queued v2 bundle lands
                            // (ROADMAP open question 3), not once per change.
  theme: "cozy-village",    // echo only — ALWAYS overwritten with the wizard's theme, valid or
                            // not, so the stored brief is self-contained and the model can never
                            // pick a skin that fights the wizard.
  scale: "village",         // ENUM outpost|hamlet|village|town|city — the ONLY size input.
                            //   outpost 28x20 / 4-building budget   hamlet 48x28 / 8
                            //   village 60x40 / 16                  town 76x52 / 34
                            //   city 104x72 / 76
                            //   The building figure is a BUDGET — the most lots the street
                            //   grid may claim — not a promise of roofs. The grid offers
                            //   4/8/20/36/80 lots, so the budget is met exactly at outpost
                            //   and hamlet and BINDS from village up; of the lots it claims
                            //   only some become door-bearing buildings. Measured across
                            //   seeds: 4 / 6-7 / 13-14 / 26-27 / 47-48 doors.
                            //   Current tuning, not contract — the authoritative table is
                            //   SCALES in 18-brief.js and it moves with the game (it already
                            //   grew once, in 0.10). Since 0.10 the compiler also MINTS
                            //   residents to a rank-sized population, so the named cast is a
                            //   minority of the town, not its whole headcount.
  surround: "fields",       // ENUM woods|fields|rocky|water|barren → ground mix, border ring,
                            // scatter density. Theme-neutral.
  prosperity: "modest",     // ENUM struggling|modest|thriving. Consumers: path material, fence
                            // quality, night-light density, ground-fill bias — the only field that
                            // makes two same-scale worlds dress differently.
  name: "Mossbrook",        // TEXT ≤24 graphemes → settlement name, World Maps root.
  flavor: "…",              // TEXT ≤140, one sentence. Arrival atmosphere. Injected ONCE at setup.
  situation: "…",           // TEXT ≤240, one sentence. "The unresolved thing happening right now —
                            // name a cause and a person, not a mood." The GM's standing hook.
                            // Injected ONCE at setup. The highest-leverage tokens in the brief.

  features: [               // 0-4 in the settlement exterior; item shape {tag, name}.
    { tag: "crop-plots", name: "The Long Furrows" },
  ],                        // tag: OPEN vocabulary resolved via the placer registry (§6);
                            // an unknown tag drops the WHOLE item (a name can never orphan a tag).
                            // name: TEXT ≤24 graphemes → a World Maps CHILD location.

  places: [                 // 0-4 additional zones; ≤2 wilds, ≤1 hall, ≤1 gathering, ≤1 sanctuary.
    { kind: "gathering",    // ENUM gathering|workshop|hall|sanctuary|dwelling|wilds → zone builder
                            // + dims (interiors 14x10–18x14 by kind, wilds 36x24). No size field:
                            // dims derive from kind + feature count, never from the model.
                            // sanctuary = the settlement's church, temple or memorial hall (16x14):
                            // the one kind built TALL — see §4.5.
      name: "The Wet Boot", // TEXT ≤24 graphemes → zone name, World Maps location.
      flavor: "…",          // TEXT ≤120, one sentence. Injected ONCE on first zone entry.
      features: [] },       // wilds only, 0-3, same item shape/rules.
  ],

  cast: [                   // 4-10 story-relevant NPCs. Sprites are their world tokens.
    { name: "Alder Vance",  // TEXT ≤24 graphemes.
      role: "hedge-mayor",  // TEXT ≤24 graphemes — GM display only (header, greeting). Free text.
      kind: "leader",       // ENUM (12): leader|host|grower|maker|merchant|guard|healer|scholar|
                            // elder|child|wanderer|folk — the MACHINE field. Derives the sprite
                            // archetype AND the special building (leader→hall, host→gathering,
                            // grower→farmhouse/hydro, guard→post, merchant/maker→workshop,
                            // elder→sanctuary when the brief names one — §4.5). A live-work
                            // premises (shop, farm, inn, sanctuary) is also its owner's HOME;
                            // a duty station (post, hall) is not.
                            // The model never picks a sprite or a building directly.
      tint: "blue",         // ENUM 9: red|orange|amber|green|teal|blue|violet|rose|grey → fixed
                            // hue table. Nine buckets cannot cluster; no raw hues, no repair loop.
      home: "Mossbrook",    // ZONE NAME reference. Resolution: exact → Unicode-folded
                            // (case/whitespace/diacritics) → the settlement root. NO substring
                            // matching — a deterministic guess can bind an NPC to the wrong zone
                            // forever. Reads only the already-finalized zone list.
      workplace: "St Aldwin's",
                            // OPTIONAL zone NAME reference, same exact → folded resolution as
                            // `home` and the same refusal to substring-match. Where the working
                            // day is spent when OWNERSHIP cannot say: the compiler infers a work
                            // anchor from what somebody owns, but ownership is one building per
                            // person and one person per building, so a school's second teacher, a
                            // market's fourth seller and a shop assistant have no way to be placed
                            // without this. Unresolved falls to NONE, never to the root the way
                            // `home` does — "works at the settlement" is not a box anyone can stand
                            // in — and the drop is recorded in `_repairs`. Omitted for anyone who
                            // works where they live or runs the place themselves, and a brief that
                            // never sets it compiles exactly as it did before the field existed.
                            // Moves the WORKING anchor only: it never rehouses anybody.
      household: 1,         // int 1-10. SAME NUMBER = SAME ROOF. The way a RESIDENT (see standing)
                            // causes a dwelling to exist, bounded by construction:
                            // "30 people → 30 houses" is inexpressible in this schema.
      persona: "…",         // TEXT ≤100 — "what they want, and what they are hiding."
                            // Injected once per NPC per session, on first interaction.
      standing: "resident" }, // OPTIONAL ENUM resident (default) | transient | fringe | destitute.
                            // How rooted they are — orthogonal to kind. Only a RESIDENT gets a
                            // dwelling; a non-resident anchors to a predictable rest spot instead:
                            // transient → a public spot (inn, a resident shop's front, or plaza;
                            // a `merchant` sets up a market stall when a lot is free), fringe →
                            // the wilds (else the settlement's outer margin), destitute → the
                            // town's public center.
                            // Does NOT affect the sprite. Settled-outsiders (a resident turned
                            // pariah) stay a GM-runtime matter; wealth/class is a separate layer.
  ],

  backgroundPopulation: 30, // int 0-500, cast included. A dial, not a ruler: since 0.10 its one
                            // consumer (20-world.js) reads it as a household count (÷3) that
                            // sets `householdTarget` WITHIN the rank's band — it can move
                            // a settlement inside its size class but never set the class, so a
                            // hamlet claiming 500 souls stays a hamlet. Zero means "no claim"
                            // and the rank's own band applies.
                            // It moves BUILT GEOMETRY, not just headcount: the target decides
                            // how many households are minted, so dwellings and doors move with
                            // it. (Illustrative, at 0.10 tuning: a seed-7 city moved roughly
                            // 76→133 residents and 36→58 doors from band floor to ceiling.
                            // The harness pins the PROPERTY — floor to ceiling grows houses
                            // and doors while the rank and the guest wing hold still — not
                            // these figures, which move with tuning.)
                            // What it CANNOT reach: the rank itself (the band clamps it), and
                            // the guest wing — GUEST_BERTHS is keyed on scale + prosperity
                            // alone, so an inn offers the same berths whatever this says.
                            // Current design, revisitable —
                            // how hard this field bites is an open tuning question, and future
                            // consumers (district walker density, the §8 population phrase)
                            // remain planned.
}
```

Exactly three numbers exist in the document (`briefVersion`, `household`, `backgroundPopulation`),
and none of them is a count of buildings, tiles, or zones. `backgroundPopulation` does reach
geometry — households minted become dwellings that get built — but only through the derivation
above and only inside the rank's band, which is the sanctioned route, not a size input.

## 2. Identity across time (compiler-owned)

At **first compile**, the compiler assigns opaque, monotonically-allocated ids — `z1…` for zones
(settlement is always `z1`), `f1…` for features, `n1…` for cast — and stores the id→name binding
**inside the sealed brief** (`_ids`). Saves, World Maps bindings, and checkpoint blobs key on ids;
names are display labels only and are never re-derived, re-slugified, or re-deduplicated. Future
append flows (new zones in 0.5.x) allocate fresh ids and never rebind or reuse old ones. Non-Latin
names are therefore fully supported: no slug is ever an identity, every cap is grapheme-counted,
every fold is Unicode-aware.

## 3. The seed contract

`compile(brief, seed)` is pure. **One entropy source**: every repaired default, top-up, split, and
dedup suffix derives from `hash(seed, fieldPath)` — never from `hash(name)`, never from a second
seed. The sealed brief is stored beside the seed in the wizard config; re-rolling the seed rebuilds
geometry from the same brief; regenerating the brief is an explicit player action, never implicit.

## 4. Repair contract (runs ONCE; the repaired brief is sealed)

Numbered passes; later passes read only fields earlier passes finalized; each pass asserts its
post-condition; `_repairs: string[]` is stored beside the brief for debugging. The raw model
response is **never stored** (checkpoints capture by value — see #5110).

1. **Transport.** Strip fences; take the outermost balanced JSON span. If `cast`/`places`/
   `features` arrives as an OBJECT keyed by anything, take `Object.values()` before the array
   check. A truncated array keeps its complete elements and drops the partial one.
2. **Scalars.** Enum folds (trim/case). `scale` receiving a NUMBER buckets it (<8 outpost, <20
   hamlet, <60 village, <200 town, else city) — the most-observed weak-model slip (population dumped into the
   size slot). Unknown enum → field default. All text sanitized (markdown/HTML/backticks/control
   chars stripped), grapheme-truncated at word boundaries; a clause-losing truncation of
   `situation` degrades to empty instead (a cut hook is worse than none).
3. **Zones.** Cap/dedupe places (folded-name collision → seed-derived suffix on the LABEL only);
   drop feature items with unknown tags whole; a `host` in the cast with no gathering place
   synthesizes AT MOST ONE interior named from the host, in the theme's own word for a common
   room — `Mira's Cantina`, `Perrin's Inn` — so the player can see which door is the inn. The
   synthesis is a **post-condition on the SEALED cast**, so it is asserted twice: here, against
   the model's draft, early enough that a `home` can resolve at the interior it just created; and
   again after the pass-6 floors, against the cast that actually sealed (below).
4. **Cast.** Bounds 4-10 (over → keep `leader` + first-N by array order, hoisting a `leader`
   found past the cap into the kept set); `home` resolution per §1. There is NO cap on how many
   people share a household number — unrelated lodgers, sisters at a convent and recruits in a
   barracks are all one number, and `CAPS.household` bounds only WHICH numbers exist (an id
   space the size of the cast), never how many share one.
5. **Derivation & caps** (buildings — the "30 people" rule; **only `resident`-standing cast
   members generate buildings** — see the §1 `standing` note):
   - dwellings = distinct **resident** households **homed at the settlement root** (a resident
     whose `home` is a place or the wilds — a forager in the woods, a chaplain who lives in her own
     church — lives THERE, so no empty town house is minted), **minus the households already housed
     at a LIVE-WORK premises** (below), **plus** anyone whose named home never claimed a lot: a
     dropped place compiles no zone, so the building they "live in" does not exist and the town owes
     them a roof like anyone else. Shared household = shared roof; a
     non-resident never gets a dwelling — it anchors to its standing rest spot (transient → the inn,
     fringe → the wilds/margin, destitute → the public center);
   - special buildings from a **resident**'s `kind` (never a duplicate hall; extra specials demote
     to workyard markers); a **place-bound** special is the exception — `elder`→`sanctuary` binds
     the church the brief NAMED and mints nothing on its own, so an elder in a church-less
     settlement claims neither a lot nor a dwelling slot (which is also what keeps every brief
     sealed before 0.8.0 compiling to the same tiles); a non-resident with a special kind builds
     nothing — except a
     **transient `merchant`**, who sets up a light market stall (3 tables, no walls) when a lot is
     free (else it loiters at a public spot like any transient);
   - **live-work vs duty station.** A workplace is a HOME only when the trade is carried on where
     the family lives: `maker`/`merchant`→shop, `grower`→farm, `host`→gathering and
     `elder`→sanctuary are **live-work** — the owner AND their household sleep there and mint no
     dwelling of their own, one household to one roof on one lot. `guard`→post and `leader`→hall
     are **duty stations**: nobody lives in a guard post, a reeve works at the hall and goes home
     to a house, so their households still need a dwelling. A brief that wants someone to live in
     a grand hall homes that cast member AT the place — the existing `home` mechanism, no new
     field. The compiler houses a household only in a live-work building it mints ITSELF; a
     special bound to a named place is that place, and the brief's own `home` says who lives in it;
   - **living quarters.** `home` naming a place is the sanctioned way to say "this person lives
     here", so a NAMED place sleeps whoever is homed in it: the building grows a quarters band and
     lays it with the same `layoutSleeping`/`partitionRooms`/`bedroom` machinery a household gets
     anywhere else, bedrooms and bunks by the same density rule. This is NOT the live-work table
     and must not be folded into it — that table decides who the compiler houses on its OWN
     initiative (nobody is given a bed in the guard post), while an explicit `home` is the brief
     OVERRIDING that default: a hall is a duty station until a brief homes the lord in it. Quarters
     are opt-in, so a place the brief houses nobody in compiles exactly the tiles it always did.
     A gathering's quarters are **distinct from its guest berths** — different bands of the
     building, lists that never intersect: a keeper is not a lodger and a traveller is never dealt
     the keeper's bed. Only a gathering lays berths at all; a named house or church sleeps its own
     people and lets nothing;
   - **lots are physical**: the street grid lays what the map is wide enough for — 4/8/20/36/80
     at the five ranks, before the `scale.buildings` budget clamps village and up to 16/34/76
     (§1's scale table is the authoritative pair of numbers). They are claimed in order — named
     places, then the specials that buy their own ground (a special bound to a named place shares
     its facade and claims no lot), then
     dwellings, then market stalls — with ONE floor: while any household is still unhoused, the
     **last free lot goes to housing**. A workshop or a named place that would leave a family with
     nowhere to sleep is not built; the house is, and the merge below puts every remaining
     household under it. `dwelling lots = min(lots left, households still owed a roof)`;
   - **over-subscription MERGES households into multi-family blocks — a named NPC's home is
     never dropped**; only filler is dropped, then the lowest-priority specials
     (leader > host > grower > maker > merchant > guard > healer > scholar > folk);
   - **interiors**: a dwelling, a shop and a farm each compile a room behind the door the building
     already has, two-way portal on that door, `mapExport = false` (§8). A duty station (post,
     hall) stays a facade — no zone is minted just to put a bed in it. A dwelling's zone id is
     `h<lowest household number under that roof>` and a workplace's is `s<owner's cast ordinal>` — keyed
     on sealed brief data, never a loop counter, so a rebuild resolves a saved zone id to the same
     room. Every resident of a dwelling gets their **own bed tile** (non-solid: the sleeper stands
     on it) and their night handle is that one tile, so "went home to rest" is something the player
     can walk in and see rather than a box on the doorstep. A live-work interior sleeps its
     household through the same `layoutSleeping` call a dwelling uses, so a trade family gets
     bedrooms and bunks by exactly the same density rules as any other family — a smith's child
     sleeps in the smithy. A shop is stocked and staffed — counter,
     shelves, and the OWNER's working anchor moved inside (only the owner's: the rest of the
     household are residents there, not staff), because an empty shop reads worse than a
     locked door. The inn's guest berths are sized from `scale` and `prosperity` (GUEST_BERTHS —
     three to thirteen of them), never from tonight's guest list; whoever arrives past the last berth
     shares the common room as before. None of this adds a save field: the
     handles are re-baked on every compile and placement is a pure function of the saved clock;
   - **height** is a facade, not a footprint: every body row of a building is already solid wall,
     hidden under roof overhead, so a tall building simply leaves its top rows UNROOFED and the
     stonework shows. A `sanctuary` takes two such rows always, plus whatever head-room its lot
     has (clamped: clear of the border ring above the upper row of lots, clear of the crossroad
     above the lower one — an outpost's rows sit tight against both and get zero), and it grows
     UPWARD so its door stays on the row the lot's apron, portal and wander boxes expect.
6. **Quality floors** (valid-but-degenerate briefs — the weak-local-model shape): after repair,
   enforce ≥2 distinct households (split by seed), ≥2 zones (synthesize one wilds), ≥3 distinct
   tints (rotate by seed), and no feature tag on more than TWO kept slots (the surplus re-rolls
   by seed from the theme's placer list). Every top-up derives from `hash(seed, floorName)`.
   **Then §4.3 again, last of all** (see pass 3): the cast floor tops up from a STOCK roster and
   every roster leads with a `host`, so a brief whose cast failed validation outright sealed a
   keeper with nowhere to keep — and the compiler builds the common room from the gathering PLACE,
   never from a `host` in the cast, so that settlement compiled as houses with no inn in it. Same
   room caps as pass 3 (`places` room for the rank, gathering cap 1) and the same ledger entry. It
   runs _after_ the wilds floor deliberately: "no named place at all" and "a keeper with nothing to
   keep" are different lacks, and a settlement whose cast was topped up gets both floors. (The
   pass-3 synthesis is the one path that still stands the wilds floor down: a model host with zero
   surviving places seals `[gathering]` and no wilds — deliberate, since that model _did_ name a
   place through its host, and the wilds floor answers namelessness, not a missing outdoors.)

**Global budget:** the sealed brief must serialize ≤8 KB; over-budget briefs truncate prose fields
in reverse-leverage order (`persona`s → zone `flavor`s → `flavor`) before anything structural.

**Read-side fold (#566).** The seal is a guarantee about the moment of sealing and nothing
re-asserted it after the brief round-tripped through chat metadata: `PF.save._configBrief` returns
`meta.pixelforgeBrief` as stored and `PF.world.build`'s gate asks only about its SHAPE, so a dozen
reads inside the compiler indexed tables with values nothing had vetted. `PF.brief.foldStored` folds
those values on a PRIVATE COPY at build()'s door, before the compiler sees them.

It is **not** a second `validate()`, and the difference is a contract: **seal time may DROP; read
time may only FOLD.** Re-running the repair passes on read would re-apply the per-rank caps and
floors to a brief sealed under a table that may not be this build's — an older build would silently
strip places a newer one seated, which is the same silent zone loss the fold exists to close. Every
array length, name and id crosses the fold untouched; only a value the compiler was about to use as
a table key can move, and it moves to the default (`_ids` and prose are not folded at all).

The fold is also why the copy is private. `PF.player.briefHashOf` hashes `JSON.stringify(brief)` over
the object `_configBrief` hands back, so a load path that returned different bytes than it was given
would sever an honest save from its own unchanged world. `validate()` is not byte-idempotent (a brief
that took repairs re-validates with an empty `_repairs`, and a stock top-up member's key order is not
the main path's) and it reorders the cast it is handed on the leader-hoist path — either alone rules
it out of the read path. Fold results ride the copy as `_folds`, surface on the compiled world as
`briefFolds` when there are any, and are **never written back** to the stored brief.

## 5. Latency & failure budget (generation BLOCKS behind a loading gate — amended twice)

_Amended from the sealed draft (which put generation in the wizard with a Skip button): the
pre-launch chat is not experience-stamped, so the #5135 route 409s before launch, and after
launch the host tears the setup UI down — there is no wizard window to block._ Generation runs
**surface-side, after launch**: the wizard stamps the player's `generate` answer into the
experience config. _The Skip button came back in 0.11 as a checkbox on the setup rather than a
button in a window that no longer exists — unchecked writes `generate: false`, no gate arms, and
the chat plays the themed default world immediately, which is also what every pre-0.4.0 save
does._
_Amended again in 0.11 (maintainer ruling #7, plan §Q3b): it no longer runs behind a toast on a
throwaway world the player is already walking in. A generate-configured chat whose brief is not
sealed holds at a **loading gate** — the sim does not step, no mutator resolves, no save is
written — because a world that is going to be discarded must never be one anybody invested in._
Package-side call budget: 90 s abort; `userContent` clamps to 7,800 chars (the route 400s
past 8,000 — a hard contract). On a 409 `chat_busy` (server-documented transient, Retry-After 15)
→ wait it out **once** inside the budget. On the route's `truncated: true` 422 → **one** plain
re-roll retry — _amended: the draft said "retry at maxTokens: 4096", but the route treats
`maxTokens` as min()-only ("never a raise"), so a numeric override could only shrink the budget;
the retry's value is length variance_ — then **salvage** from the LONGEST `raw` seen across both
attempts (transport pass rules: balanced span, complete array elements) and let the floors top up
the rest. **NO FAILURE SEALS A WORLD** — only the two outcomes that produce a real brief do:
success and salvage. Every other outcome, transient (404 route-absent, 409, 429, 5xx, network
error, budget timeout) _and deterministic_ (400 contract, `provider_error`/parse-failure 422),
leaves the chat **unsealed**: the key stays absent, the gate shows a retry screen, and the next
visit arms it again.
_Revised in 0.11 (maintainer ruling #7, plan §Q3b). The 0.4.0 ladder sealed themed defaults on a
deterministic/paid failure, on the reasoning that a paid call per visit is worse than the default
world. That decision predates the loading gate, which now holds play precisely so that nobody
invests in a world that is going to be discarded — so sealing a default is no longer "the world
they were already walking in", it is a permanent decision made on their behalf in the one case they
cannot undo. The `userContent` clamp above also makes a reachable 400 a contract bug rather than a
long setting. The ladder reports the failure KIND instead (`unavailable` | `refused` | `network` |
`timeout`), and the retry screen says which._
The sealed result stores **atomically** under the top-level `pixelforgeBrief` metadata key
(shallow-merge PATCH, 3 retries — never a read-modify-write of the whole setup config), and the
world rebuilds in place when it lands; the stored key doubles as the one-shot guard, so a chat
never generates twice. Token budgets in this spec are asserted, not measured — the pre-ship gate is running the
guidance through the smallest target models N times and counting parse failures, enum drift,
ceiling overruns, and wall-clock (tracked as a 0.4.0 validation TODO).

## 6. The placer registry (feature vocabulary)

`PLACERS[tag][theme] ?? PLACERS[tag].neutral ?? drop-item`. The vocabulary is OPEN (a new theme or
tag ships placers with zero schema/prompt change), but **every tag in the shipped guidance must
have a placer for EVERY shipped theme, enforced by a startup assertion over the registry** — the
fallback chain is for third-party extension, not for shipping silent per-theme feature loss.

| tag            | cozy-village           | sci-fi-colony            |
| -------------- | ---------------------- | ------------------------ |
| water-feature  | pond + well            | coolant pool + recycler  |
| crop-plots     | fenced crops           | hydroponics trays        |
| market-stalls  | table/awning row       | vendor kiosk row         |
| workyard       | fenced stone yard      | cargo pad + crates       |
| landmark-stone | standing stone + light | monument mast + beacon   |
| shrine         | stone pad + fence      | memorial alcove          |
| water-crossing | stream + ford          | coolant channel + bridge |
| dense-growth   | heavy trees            | mast/antenna field       |
| ruin           | roofless broken walls  | breached hull section    |
| lookout        | raised stone pad       | observation platform     |

**Water and roads (0.12).** Exactly one placement relaxed: a **wilds `water-feature`**, which runs
a second pass of eight anchor attempts with the approach road off the reservation once the strict
eight are spent. A settlement anchor overlapping an artery is still refused outright for every tag
including this one, and `water-crossing` scans no anchors at all — the builder paints it at a fixed
spot. Where a road runs through a water rect the road tiles are laid as **bridge** — a walkable
treatment drawn over the water — and the water takes the rest (`20-world.js` `waterFill`). The
crossing's hand-painted ford is the same idea and migrated onto the same tile, so the "ford" and
"bridge" in the table above are now one visual system rather than two. It is a placement
treatment and **not a taggable feature**: no new row in this vocabulary, no new `_ids` ordinal,
and a settlement pond that decks a plaza with planks is a blessed outcome rather than a case to
guard against — the plaza's `path` decks, while a `thriving` settlement's paved central 4×4 is
`stone`, deliberately outside `ROAD_GROUND`, and waters over instead. What it bought is a
`water-feature` in the wilds at all — the 8×5 anchor could never clear the reserved road band, so
before this the wilds pond a brief asked for simply never existed.

## 7. Injection discipline (metering the prose)

Written here because it is what keeps the brief from taxing every turn forever: `name` + free-text
`role` ride the per-turn header **always**; `situation` injects **once, on the first outbound
turn**; a zone's `flavor` injects **once on first entry**; an NPC's `persona` injects **once per
NPC** (first interaction). The one-shot flags **persist in saves** and burn only when the host
_accepts_ the turn (a refused send never loses the prose), so a reload never re-taxes the
context. Nothing else from the brief ever enters GM context — the durable channel is **chat
history**: each injection lands once inside a committed turn and stays in the transcript the GM
re-reads every generation.

## 8. World Maps export (shipped in 0.5.0)

_History: the sealed draft made World Maps the durable channel via an export "at first compile";
that was deferred because no runtime location write API existed, and the durable channel became
chat history (§7 — unchanged). World Maps 1.4.0 shipped the write path
(`POST /api/chats/:chatId/spatial-context/locations`, Marinara-Engine#5144), so the export now
runs._

Once the exterior binds to its starting location (the §50-spatial seed binding), every other
compiled zone registers as a **child of that bound location**: interiors as `kind: "building"`,
wilds as `kind: "place"`, `description` from the zone's `flavor`. A root child that already
carries a zone's name (trim + case-insensitive; hand edits or the wizard's map instructions
often author these first) is **adopted** — bound instead of twinned — because the additive
route could never merge duplicates later. Location ids for created rows are seed-stable —
`pf.<fnv32(seed)>.<zoneId>` — and the map definition itself is the idempotency ledger: ids
already present are diffed out before posting, so re-runs (new sessions, rebuilds from the same
brief) add nothing and merely re-bind. The route is additive with revision CAS; a stale or
conflicted 409 re-reads and retries, surrendering after no-progress rounds so a live map editor
(or a write-eating proxy) is never dueled. Completion state is keyed by **world object
identity** — a rebuild (brief arrival, rewind) is a new world and re-syncs, which the diff turns
into a cheap re-bind/self-heal. The export never runs for: the interim pre-brief boot world of a
generation-enabled chat (`world.interim`, stamped by §60-save — its throwaway zones must not
pollute the map), shared-world-linked chats (an additive write would stage unpublished draft
edits to a communal world), or a definition whose location list is not visible. A stale root
binding (map replaced/started over) prunes the dead bindings so the exterior re-seeds and the
export re-runs under the new root; deliberate refusals (archived parent, the location cap, route
absent) end the attempt for the session with no retry drumbeat. Exported ids land in
`world.bindings`, which is what lets travel and narrated drift teleport into generated zones.

**One building, one location.** A zone that is a ROOM inside another zone's building — a floor,
a back room — stamps `mapExport = false` and is skipped: no row, no binding, reached only through
the building it sits in. Named brief places (the sanctuary included) export their single row;
generated dwellings, shops and farms — which since 0.8.0 do compile interior zones (§4.5) — never do:
they are rooms inside a building the settlement already contains, not destinations of their own.
The gate exists because this route is additive with **no delete**: a row written to a player's real
map is permanent, so it ships with the zone type that needs it rather than a release later.

Not yet exported: the root's population phrase (still §9 territory) and per-feature locations —
features have no zones of their own, and decorating the root would edit a location the user may
have authored (the route deliberately cannot).

**0.12's feature register is deliberately NOT exported here, and that is a decision rather than an
oversight.** The register (§9) now holds a rect per feature, which is the first per-feature
geometry the package has ever had, so extending this export is the obvious next thought. It is
declined: rows written by this route are permanent on a player's real map with no delete, no field
on a location is shaped to hold a rect, and the register is recomputed from the sealed brief on
every compile — so an export would stamp derived, re-derivable data irreversibly onto somebody's
map. The determinism lane in `test-brief.mjs` (same seed + brief → the same register) is the sole
guard the register needs, and it is enough because nothing outside the package ever sees it.

## 9. Reserved consumers

The schema seals fields before their consumers exist, so shipped briefs never need regeneration
when a consumer lands — the schema is the contract, not the renderer. The pattern has paid out
three times now: `prosperity` drives dress (path material, fence quality, night-light density,
ground-fill bias), `backgroundPopulation` leans the minted population within its rank's band
(0.10, §1), and **feature `name` labels went live in 0.12** — a brief that named a pond eight
releases ago says that name on a player's screen today, with no regeneration and no schema change.

How the name arrives, since it is the pattern working exactly as designed. The compiler's
placement loop records every feature it places into a per-zone register (`zone.features[]` —
`{id, tag, name, rect}`, `20-world.js` `recordFeature`), and the `id` is the feature's **`_ids`
ordinal** from §2, mirrored by POSITION rather than looked up by name so two features sharing a
name cannot swap identities. The register is DERIVED and never serialized: it is recomputed from
the sealed brief on every compile, so it costs no save bytes and cannot drift. What consumes the
name is the fishing verb — the Fish button reads `🎣 Fish <name>` off the register row under the
player's hand (`70-hud.js`), and each session's ledger line names the spot it was fished at
(`59-economy.js` `_logDay`), which is what the journal panel shows and what the GM is told at the
wrap-up. The planned on-map signage / inspect-text consumer (roadmap S2) is still ahead; this is a
second consumer of the same field, not a replacement for it.

Still waiting for a consumer: the root's population phrase (§8).

## 10. Guidance note on theme mismatch

The shipped guidance states verbatim: _the theme is authoritative; dress the player's setting text
to fit it._ A player typing "cyberpunk megacity" under `cozy-village` gets a cozy village wearing
cyberpunk names — coherent tiles, themed prose — never a schema error. (A wizard-side nudge when
the free text is far from the chosen theme is a 0.4.x follow-up.)
