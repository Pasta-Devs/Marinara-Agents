# The World Brief — schema v1 (sealed spec)

**Architecture:** the LLM decides *what exists*, the algorithm decides *where every tile goes.*
One structured call at game creation (engine #5135, route
`POST /api/game/:chatId/experience-generation`) turns the wizard's preferences into a compact
**brief**; a deterministic compiler builds the tile world from `compile(brief, seed)` forever
after. This document is the contract between them.

Synthesized from a three-draft adversarial panel (minimal-enum ×  repair-first base, judged by a
cost skeptic and the compiler author). Design rule inherited from the product discussion: **the form
does the teaching** — the model fills vocabularies and bounded lists; free text exists only where a
named consumer in shipped code reads it, and no field the model writes can become geometry except
through the derivations below.

---

## 1. The schema

```js
{
  briefVersion: 1,          // int. Bumped only when a field's MEANING changes.
  theme: "cozy-village",    // echo only — ALWAYS overwritten with the wizard's theme, valid or
                            // not, so the stored brief is self-contained and the model can never
                            // pick a skin that fights the wizard.
  scale: "village",         // ENUM outpost|hamlet|village|town — the ONLY size input.
                            //   outpost 28x20 / base 4 buildings   hamlet 34x24 / 6
                            //   village 44x30 / 8                  town 56x38 / 12
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

  places: [                 // 0-4 additional zones; ≤2 wilds, ≤1 hall, ≤1 gathering.
    { kind: "gathering",    // ENUM gathering|workshop|hall|dwelling|wilds → zone builder + dims
                            // (interiors 14x10–18x12 by kind, wilds 36x24). No size field: dims
                            // derive from kind + feature count, never from the model.
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
                            // grower→farmhouse/hydro, guard→post, merchant/maker→workshop…).
                            // The model never picks a sprite or a building directly.
      tint: "blue",         // ENUM 9: red|orange|amber|green|teal|blue|violet|rose|grey → fixed
                            // hue table. Nine buckets cannot cluster; no raw hues, no repair loop.
      home: "Mossbrook",    // ZONE NAME reference. Resolution: exact → Unicode-folded
                            // (case/whitespace/diacritics) → the settlement root. NO substring
                            // matching — a deterministic guess can bind an NPC to the wrong zone
                            // forever. Reads only the already-finalized zone list.
      household: 1,         // int 1-6. SAME NUMBER = SAME ROOF. This is the ONLY way the model
                            // can cause a dwelling to exist, and it is bounded by construction:
                            // "30 people → 30 houses" is inexpressible in this schema.
      persona: "…" },       // TEXT ≤100 — "what they want, and what they are hiding."
                            // Injected once per NPC per session, on first interaction.
  ],

  backgroundPopulation: 30, // int 0-500, cast included. NARRATIVE TEXTURE, never geometry:
                            // consumers are the World Maps root description phrase and ambient
                            // walker density clamp(round(pop/12), 0, 8). No other reader.
}
```

Exactly three numbers exist in the document (`briefVersion`, `household`, `backgroundPopulation`),
and none of them is a count of buildings, tiles, or zones.

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
   hamlet, <60 village, else town) — the most-observed weak-model slip (population dumped into the
   size slot). Unknown enum → field default. All text sanitized (markdown/HTML/backticks/control
   chars stripped), grapheme-truncated at word boundaries; a clause-losing truncation of
   `situation` degrades to empty instead (a cut hook is worse than none).
3. **Zones.** Cap/dedupe places (folded-name collision → seed-derived suffix on the LABEL only);
   drop feature items with unknown tags whole; a `host` in the cast with no gathering place
   synthesizes AT MOST ONE interior named from the host (the player can walk into the inn).
4. **Cast.** Bounds 4-10 (over → keep `leader` + first-N by array order, hoisting a `leader`
   found past the cap into the kept set); `home` resolution per §1; a household >6 members
   splits **per member** by `hash(seed, "household-split-<memberId>")`, scanning forward
   (wraparound) to the first household with room — deterministic, no clustering on one target.
5. **Derivation & caps** (buildings — the "30 people" rule):
   - dwellings = distinct households; shared household = shared roof;
   - special buildings from `kind` (never a duplicate hall; extra specials demote to workyard
     markers);
   - residential filler = `clamp(BASE[scale] − dwellings − specials, 0, ∞)`,
     area cap `floor(buildableArea / 56)`;
   - **over-subscription MERGES households into multi-family blocks — a named NPC's home is
     never dropped**; only filler is dropped, then the lowest-priority specials
     (leader > host > grower > maker > merchant > guard > healer > scholar > folk).
6. **Quality floors** (valid-but-degenerate briefs — the weak-local-model shape): after repair,
   enforce ≥2 distinct households (split by seed), ≥2 zones (synthesize one wilds), ≥3 distinct
   tints (rotate by seed), and no feature tag on more than TWO kept slots (the surplus re-rolls
   by seed from the theme's placer list). Every top-up derives from `hash(seed, floorName)`.

**Global budget:** the sealed brief must serialize ≤8 KB; over-budget briefs truncate prose fields
in reverse-leverage order (`persona`s → zone `flavor`s → `flavor`) before anything structural.

## 5. Latency & failure budget (generation never blocks — amended)

*Amended from the sealed draft (which put generation in the wizard with a Skip button): the
pre-launch chat is not experience-stamped, so the #5135 route 409s before launch, and after
launch the host tears the setup UI down — there is no wizard window to block.* Generation runs
**surface-side, after launch**: the wizard stamps `generate: true` into the experience config and
seeds the themed default world, so the player is walking immediately; the one call runs behind a
toast. Package-side call budget: 90 s abort; `userContent` clamps to 7,800 chars (the route 400s
past 8,000 — a hard contract). On a 409 `chat_busy` (server-documented transient, Retry-After 15)
→ wait it out **once** inside the budget. On the route's `truncated: true` 422 → **one** plain
re-roll retry — *amended: the draft said "retry at maxTokens: 4096", but the route treats
`maxTokens` as min()-only ("never a raise"), so a numeric override could only shrink the budget;
the retry's value is length variance* — then **salvage** from the LONGEST `raw` seen across both
attempts (transport pass rules: balanced span, complete array elements) and let the floors top up
the rest. Only outcomes worth sealing seal: success, salvage, or a deterministic/paid failure
(400 contract, `provider_error`/parse-failure 422) → themed defaults. Transient outcomes — 404
route-absent, 409, 429, 5xx, network error, budget timeout — leave the chat **unsealed**: the
key stays absent and the next visit simply tries again (the default world plays fine meanwhile).
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

| tag             | cozy-village            | sci-fi-colony              |
| --------------- | ----------------------- | -------------------------- |
| water-feature   | pond + well             | coolant pool + recycler    |
| crop-plots      | fenced crops            | hydroponics trays          |
| market-stalls   | table/awning row        | vendor kiosk row           |
| workyard        | fenced stone yard       | cargo pad + crates         |
| landmark-stone  | standing stone + light  | monument mast + beacon     |
| shrine          | stone pad + fence       | memorial alcove            |
| water-crossing  | stream + ford           | coolant channel + bridge   |
| dense-growth    | heavy trees             | mast/antenna field         |
| ruin            | roofless broken walls   | breached hull section      |
| lookout         | raised stone pad        | observation platform       |

## 7. Injection discipline (metering the prose)

Written here because it is what keeps the brief from taxing every turn forever: `name` + free-text
`role` ride the per-turn header **always**; `situation` injects **once, on the first outbound
turn**; a zone's `flavor` injects **once on first entry**; an NPC's `persona` injects **once per
NPC** (first interaction). The one-shot flags **persist in saves** and burn only when the host
*accepts* the turn (a refused send never loses the prose), so a reload never re-taxes the
context. Nothing else from the brief ever enters GM context — the durable channel is **chat
history**: each injection lands once inside a committed turn and stays in the transcript the GM
re-reads every generation.

## 8. World Maps export (deferred — amended)

*Amended: the sealed draft made World Maps the durable channel via an export "at first compile."
There is no runtime write API for locations — `spatialMapInstructions` is a create-time mode flag
only, and by the time the brief exists the map does too. The durable channel is chat history
(§7).* The export design is retained for when a location write path ships: root
`{name, description: flavor + " " + populationPhrase(backgroundPopulation), kind: root}`; each
place `{name, description: flavor, parentId: root, kind by zone kind}`; each feature
`{name, description: tag's theme label, parentId: its zone}`; keyed by §2 ids.

## 9. Reserved consumers (sealed now, wired in 0.5.x)

Three sealed fields have no in-world consumer yet: `backgroundPopulation` (planned: ambient
walker density + the §8 population phrase), `prosperity` (planned: building extras/decoration
density), and feature `name` labels (planned: on-map signage/inspect text). They are validated,
repaired, and stored **now** so shipped briefs never need regeneration when the consumers land —
the schema is the contract, not the renderer.

## 10. Guidance note on theme mismatch

The shipped guidance states verbatim: *the theme is authoritative; dress the player's setting text
to fit it.* A player typing "cyberpunk megacity" under `cozy-village` gets a cozy village wearing
cyberpunk names — coherent tiles, themed prose — never a schema error. (A wizard-side nudge when
the free text is far from the chosen theme is a 0.4.x follow-up.)
