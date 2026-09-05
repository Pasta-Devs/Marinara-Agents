# The player state block — S5 (wire contract and machinery)

**Architecture:** the world is a pure function of `(seed, theme, brief, clock)`; the _player_ is not.
One namespaced, versioned `player` block inside the save snapshot holds everything that cannot be
recomputed — the pouch and the purse, skills and equipped tools, the relationship ledger, quest
state, the day-ledger buffer, discovery state, and the home anchor. Everything else is rebuilt from
the seed on every boot, which is what makes a rewind safe and a rebuild byte-identical.

This document is written for the two readers who will actually need it: **a future build's
implementer** (wire format, field classes, migration and quarantine contracts) and **the GM-prompt
author** (what state exists, what the mutators enforce, and what a consumer may assume). It
describes the code as built. Where a claim is load-bearing the file and symbol are named, so a
change that invalidates a sentence here is a change that has to walk past the sentence.

**0.12 is the first release to write into the block rather than only to define it**, and this
document grew with it: skills and equipped tools now hold real rows, the pouch holds catches, the
day ledger holds lines somebody wrote and a **notice band** beside them, and there is a verb
surface (§7) and a wrap-up lifecycle (§8) that did not exist a release ago. One 0.12 field lives
deliberately **outside** the block — `sim.intro.ledgerOwed`, the durable half of the flush — and
§8.1 says why a field about the player's days is not in the player's block.

**0.13 is the release that finally calls the mutator 0.11 shipped.** `quest()` and the two
completion maps had been in the block since S5 with no producer and no renderer; the quest layer
(§9) gives them a board, a second sealed content artifact, three verb sites and a tab — and adds
**not one field to the wire**, which is the strongest thing this document can say about a release.
§10.2 measures what it did add, and §12 is the new home for the verification this package cannot do
for itself.

**0.14 adds nothing to the wire at all, and that is the number this document leads with.** No key in
the block, no field in the envelope. The sky is a pure function of `(seed, day, override)` — the same
trick schedules pull — the climate axes are a runtime stamp re-minted on every compile, the dialogue
window's latch is runtime-only, and the GM's weather override lives at its own chat-metadata key
rather than in the save. §7.9 specifies the sky, the calendar, the derivation, the override and the
schedule bias the town answers with; §7.10 specifies the dialogue window; §7.6 gains the sky's and
the region's effect on the bite. Both new subsections sit at the end of §7 rather than as a new
top-level section so that §10, §11 and §12 keep the numbers other documents cite them by.

Companion documents: `brief-schema.md` (the world brief, which the block's stamps hash — the feature
register the fishing verb aims at since 0.12, and the two optional climate axes since 0.14) and
`ROADMAP.md` (why S5 led 0.11, what it gates, and what the 0.12, 0.13 and 0.14 rulings put on the
list).

---

## 0. Where it lives

| concern                                                             | file                                        |
| ------------------------------------------------------------------- | ------------------------------------------- |
| the block, its serializer, its migrations, its mutators, its caps   | `src/58-player.js` (`PF.player`)            |
| the quarantine store                                                | `src/58-player.js` (`PF.quarantine`)        |
| the envelope, the two stores, the decision ladder, the loading gate | `src/60-save.js` (`PF.save`)                |
| item vocabulary, prices, the berth, the starting purse              | `src/59-economy.js` (`PF.economy`)          |
| the verbs and their tables: fishing, the rod ladder, sleep          | `src/59-economy.js` (same module — §7)      |
| the content pack, the board's offers, the quest lifecycle           | `src/61-pack.js` (`PF.pack` — §9)           |
| the pack's two metadata keys, its fold, and the gate that seals it  | `src/60-save.js` (`packFold`, `packExpected`) |
| the mint stamp the block compares against                           | `src/20-world.js` (`mintStampOf`, `MINT_V`) |
| the feature register the fishing verb aims at                       | `src/20-world.js` (`recordFeature`)         |
| the board fixture every settlement gets                             | `src/20-world.js` (`BOARD_FEATURE_ID`)      |
| the block's default-init on a fresh sim                             | `src/30-sim.js` (`new PF.Sim`)              |
| the clock movers, the wrap-up marker, the tell                      | `src/30-sim.js` (`advanceMinutes`, `stageLedgerOwed`, `_composeLedger`) |
| the fourth proximity read the board button gates on                 | `src/30-sim.js` (`nearBoard`, inside `step`) |
| the journal panel, the quest tab and the character sheet            | `src/70-hud.js` (`PF.Hud`)                  |
| the transport                                                       | `src/00-prelude.js` (`PF.api`)              |
| every claim below, driven                                           | `test-brief.mjs` cases (q)–(az)             |

The block is one key inside the save envelope, not a store of its own. The envelope goes to **two**
places on every flush in routes mode: the timeline-anchored route row
(`PUT /api/game/:chatId/experience-state`, engine #5102) which is the authority, and the
`pixelforge` chat-metadata key which is a write-through boot cache and the fallback on an engine
without the routes. The quarantine bag is the exception — it has its **own** metadata key, because
the whole point of a quarantine is that it survives the write that replaces what it is holding.

---

## 1. The schema

```js
player: {
  v: 1,                          // the BLOCK's version, not the envelope's
  game: 1,                       // "New game" ordinal; older-game rows are ignored, never deleted
  world: { seed, briefHash, mintStamp },   // + `interim: 1` on a throwaway pre-brief save
  flushedDay: 0,                 // coupled to ledger.lines

  // ── world-free ────────────────────────────────────────────────────────────
  pouch: { money: 0, items: [ { t: "rod", q: 1, k: "crude" }, { t: "catch-common", q: 4, k: "carp" } ] },
  skills: {
    verbs: { fishing: { l: 1, x: 0 } },
    equipped: { fishing: { tool: ["rod", "crude"], mod: ["bait", "worms"] } },
  },
  quests_done_board: { "b:deliver-herb": 3 },

  // ── world-bound ───────────────────────────────────────────────────────────
  rel: { z1: { "Alder Vance": { d: 2, t: 9, h: 1, s: "…", a: 7 } } },
  quests: {
    done_pack: { "p:pk1:rat-cellar": 1 },
    active: [ { id, g: "z1|Alder Vance", verb, target, n, have, r: { money, xp }, day } ],
  },
  bought: null,                  // optional shop-depletion seam; absent until something is in it
  ledger: {
    lines: [ [37, "Fished the Millpond — 6 casts: carp ×2."], [12, "Day 12: 4 things happened.", 4] ],
    notices: [ [9, "…is back.", 1], [11, "…set aside."] ],   // 0.12: the BAND; emitted only when non-empty
  },
  found: { zones: [ { p: "z4", e: 0, d: 3, day: 12, seen: true } ] },
  home: null,                    // a sealed anchor ("z3") or { minted: true } — never a bare h{n}
}
```

Short keys everywhere, no uuids, no derived values cached, no names stored except `rel` keys and
the `s` lines. `defaultPlayer()` (58-player) is the literal above with everything empty; its key
order **is** the wire order and the serializer reproduces it exactly.

**Two subtrees are the whole of 0.12's schema delta, and neither is a new top-level key.**
`skills.verbs` and `skills.equipped` were shipped empty in 0.11 and now carry rows (§7.4);
`ledger.notices` is new (§8.3). **One 0.12 field is deliberately NOT here:**
`sim.intro.ledgerOwed` — the last day a completed sleep made owed — lives under the envelope's
existing `intro` key rather than in the block, and §8.1 gives the reasoning and the one cost it
carries. Nothing else moved: no key was renamed, no key was dropped, and the pinned wire literal
(§2.4) did not move for either of the two subtrees, because both are empty on a block that has
never used them.

### 1.1 Field classes

Every field declares one of three properties. This is not documentation of an intention — it is the
partition `applyStamps` and `transplant` actually implement, and a new field that does not declare
one will be silently treated as world-free by the first and dropped by the second.

| class           | fields                                                                                | what it means                                 | who acts on it                                            |
| --------------- | ------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------- |
| **world-free**  | `pouch`, `skills`, `quests_done_board`, `game`, and a newer build's unknown keys      | means the same thing in any world             | crosses every seam untouched                              |
| **world-bound** | `rel`, `quests.active`, `quests.done_pack`, `found`, `home`, `ledger.lines`, `ledger.notices`, `bought` | meaningless once the world changed under it   | quarantined whole on a brief change; never carried across |
| **coupled**     | `flushedDay`                                                                          | only interpretable against the lines it gates | quarantined _with_ the lines, and clamped when they go    |

**`ledger.notices` is the one world-bound field that is DROPPED rather than parked, and that
became true with the format.** Every other world-bound field goes into the `stamp` entry a brief
severance writes, so it comes home if the world does (§3.4). The band does not: `applyStamps`
replaces `player.ledger` wholesale and puts no `notices` in the entry, so a brief severance loses
whatever the band was still holding, permanently. It is a real regression against the shape that
preceded it — a notice used to BE a ledger line, and a severed line was parked with the rest — and
it is accepted rather than dressed up: the band's rows are short informational strings about
events the player has usually already been told about, the one that matters most is the notice the
severance is *about to write* (which 60-save appends after the strip, so it survives), and making
the band restorable would mean parking a field whose whole purpose is to explain the parking.
Recorded in §11.

Note what is **not** touched by a severance: `intro.ledgerOwed` (§8.1). It is world-unbound and
correctly so — the days it owes are days the player lived, whatever world they lived them in.

`bought` is **world-bound**, and the reason is worth stating because its shape suggests otherwise:
it counts what a NAMED shop's stock has lost, and both the shop and its stock table are compiled
from the brief, so carried across a brief change it depletes a stranger's shelves.

`flushedDay`'s clamp is `min(flushedDay, minSeveredLineDay − 1)`, floored at 0, and it fires **only
when lines were actually severed** — an empty buffer must leave the gate exactly where it was, or a
save with nothing to lose still loses its day boundary. The same guard is re-applied on restoration
and on the transplant, because both put whole fields back by assignment and a restored line at or
below the gate would never be told (`log()` refuses any day the gate covers).

### 1.2 What the caps do, per cap

The caps are **gameplay and hygiene bounds, not a size budget** (maintainer ruling; see §10). They do
not all behave the same way, and a consumer has to know which calls can come back empty:

| behaviour                                          | caps                                                                                                                                                                                 | what the caller sees         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| **evict** (the cap makes room, the call succeeds)  | `relLines` (evicts the oldest _line_, the row stands), `boardDone`/`packDone` (evict the least-earned counter), `ledgerDays`/`ledgerPerDay`/`ledgerStubs`, `notices` (told-oldest first), `found` (oldest by `day`) | success                      |
| **truncate** (the value is cut, the call succeeds) | `lineChars`, `ledgerChars`, `skillLevel` (the level stops climbing and xp is zeroed at the ceiling)                                                                                  | success                      |
| **refuse** (the call does nothing and says so)     | `items` (`grant()` → `0` on a new `(t,k)` row), `activeQuests` (`quest("accept")` → `false`), `relRows` (`bump()` → `null` when there is no stranger-tier row left to evict)         | the documented refusal value |

Current values (`CAPS`, 58-player): items 60, relRows 150, relLines 30, lineChars 80,
activeQuests 10, boardDone 40, packDone 40, bought 30, ledgerDays 3, ledgerPerDay 15,
ledgerStubs 30, ledgerChars 200, **notices 12**, found 80, skillLevel 20.

**A third eviction order joined the two below in 0.12, and it is the only one keyed on a flag
rather than on age.** `notices` prefers a **told** row and takes the oldest of those; it evicts an
untold row only when every row in the band is untold (`evictNotices`, 58-player). The reasoning is
the band's whole contract: a told notice is one the player has already been given at a wrap-up and
can only lose from the panel, while an untold one is a sentence nobody has heard yet, so it is the
last thing to go. Twelve is small on purpose — a block carrying a dozen unread explanations of
what has happened to it has bigger news than the thirteenth.

Two further eviction orders matter and are easy to conflate. The **row** cap prefers a STRANGER-tier row
(`d === 0`, fewest encounters, no line, not hostile) — a row the player built something with is
never the first to go, and an enemy is something built. That is a _preference_ and it can run out,
and what happens then depends on the path. At the LIVE cap `bump()` **refuses** (the refuse row
above) — there is no last resort there. The paths that put whole fields back by assignment
(restoration and the transplant, the only two that reach `_enforceCaps`) cannot refuse, so they fall
through to `_evictToRowCap`: cheapest-loss-first by (ladder tier, then whether a line hangs off it,
then hostility, then encounters, then the composite zone id and name), and the head of that order
goes until the count fits. The **line** cap is a different cap with a different victim: past thirty
lines the oldest `s` goes and its row stays exactly where it was, ladder and encounter count intact.
Recency is the serialized `a` mark, not insertion order — without it the ordering inverts after a
reload and the eviction drops the newest line.

---

## 2. The wire contract

### 2.1 Canonical ordering

`PF.player.serialize(player, dropCarry)` is by value, deterministic, and byte-stable under
`JSON.stringify`. This is an interface, not an implementation detail: **every dedupe in the save
path is string equality over the serialized snapshot** — the flush's `_lastSerialized` and
`_metaSerialized`, adopt's comparison against the server row, and `checkRewind`'s. An order that
drifted with the source would forge both spurious saves and spurious "The world rewound with the
story." toasts.

Emission order, exactly:

1. **unknown keys first**, sorted, only when there are any (§2.2);
2. `v`, `game`, `world` (`+ interim` when set), `flushedDay`;
3. `pouch`, `skills`, `quests_done_board`, `rel`, `quests`;
4. `bought`, only when non-empty;
5. `ledger`, `found`, `home`.

Within each field:

- `pouch.items` sorted by `(t, k)` — the bag is a SET keyed that way, so insertion order is an
  accident of play;
- `skills.verbs`, `skills.equipped`, `quests_done_board`, `rel` (both levels), `bought` (both
  levels) rebuilt through `sortedMap`;
- `quests.active` sorted by `id`;
- `found.zones` sorted by the composite `p|e|d`;
- **`ledger.lines` is chronological and never sorted.** The buffer is a transcript and its order is
  its meaning; a JSON round-trip preserves array order, so it is stable without being sorted.
  **`ledger.notices` is the same, for a sharper version of the same reason** — the band is a
  sequence of events about the save, and after a rewind a restore's notice honestly carries a day
  BELOW the severance notice it is the sequel to. Sorting it by day would print the world coming
  back above the sentence saying it went. `notices` is emitted **after** `lines` and only when
  non-empty (§2.3), so `ledger` is `{lines}` on every block that has never had anything explained
  to it.

`sortedMap` is deterministic rather than literally sorted for an integer-like key, because JS
enumerates those first whatever the insertion order. Determinism is the property the dedupe needs;
alphabetical order is merely the cheapest order that cannot drift.

Harness case **(q)** drives this from the other end: two players who did the same things in a
different order must serialize to the same bytes, and a round trip through `parse()` must change not
one byte.

### 2.2 Unknown keys ride through

`PLAYER_KEYS` is the set of block keys this build understands. Anything else on a restored block was
written by a **newer build at the same `player.v`**, and `serialize()` re-emits it rather than
dropping it — the same additive-only contract `ENVELOPE_KEYS` gives the envelope one level up.
Round-tripping a chat through an older client is otherwise data-destructive: the older read drops
the field and the very next flush overwrites the row without it.

Two rules follow, and both are enforced by assertions rather than by care:

- **additions to `serialize()`'s literal MUST be added to `PLAYER_KEYS`** (58-player), exactly as
  additions to `snapshot()`'s literal must be added to `ENVELOPE_KEYS` (60-save). Each list has its
  own load-time assertion and each asserts BOTH directions: the envelope's off a synthetic sim (and
  re-driven against a real one by the harness), the block's off a MAX-SHAPE block — `bought` is
  optional and an empty one is deliberately not emitted (§2.3), so a default block would never
  exercise the listed-but-not-emitted direction at all;
- a key that is listed but only _sometimes_ emitted is worse than one missing from the list — the
  list makes the reader skip it on the way in, so it never reaches the carry either, and the write
  silently deletes a newer build's field. That is the slice-1 bug. `player` is therefore emitted
  **unconditionally** from `snapshot()`, with no `if (sim.player)` anywhere.

`"__proto__"` is skipped at every map read and every carry loop: `JSON.parse` hands it back as an
own property and assigning it onto a plain object sets the PROTOTYPE instead of a key. The same
discipline covers reads — `_ownRead`/`_bucket` exist because a bare `map[key]` walks the prototype
chain, and `board["constructor"]` is a function, not `undefined`.

### 2.3 Optional keys

A key that carries nothing is not emitted, so a block that has never used a feature is byte-identical
to one written before the feature existed:

| key                           | emitted when                                                         | why it is optional                                                                                                                         |
| ----------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `world.interim`               | the save was flushed while standing in the throwaway pre-brief world | all-zero stamps are also what a pre-S5 save looks like, and `unstamped` adopts one of those wholesale; the key is what tells the two apart |
| `rel[z][name].h`              | the row is hostile                                                   | a flag on every row is pure size for nothing                                                                                               |
| `rel[z][name].s`              | the row holds a remembered line                                      | ditto for an empty string                                                                                                                  |
| `rel[z][name].a`              | alongside an `s`, and only when the recency mark is non-zero         | a parent build wrote `s` lines with no mark at all; a flat `"a":0` on each would move bytes this change never declared                     |
| `bought`                      | something has been bought                                            | an empty object every save is four bytes of nothing                                                                                        |
| a ledger line's third element | the line is a STUB, carrying the count it stands for                 | plain lines stay two-element                                                                                                               |
| `ledger.notices`              | something has been explained to the player                           | `bought`'s precedent one level down: every save in the wild would otherwise gain an empty array for a band it has nothing to put in        |
| a notice row's third element  | the notice has been TOLD at a wrap-up                                | untold rows stay two-element, and untold is the state most rows spend the least time in                                                    |

A notice row is `[day, text]` untold and `[day, text, 1]` told. **The told flag is what the
wrap-up reads, in place of the day gate the lines answer to** — which is the whole reason the band
left `lines` (§8.3) — and it is also the one thing the journal panel deliberately does not draw:
the band shows told and untold rows alike, so a burn changes nothing on screen. A row whose text
clips to nothing is dropped at serialize time rather than stored: `notice()` already refuses empty
text, so no row this build writes arrives blank, but a hostile save carrying `[3, "   "]` would
otherwise cost bytes, a slot against the cap, and a blank line in the panel no writer could
account for.

The stub count is not cosmetic: re-compacting an already-stubbed day sums the _counts_, not the
lines, which is what stops an elided day that held twelve things becoming "1 thing happened." on the
next append.

### 2.4 Byte-stability policy, and the one sanctioned change

The exact bytes of a snapshot are pinned to a hand-built literal in the harness ("THE WIRE FORMAT IS
PINNED TO A LITERAL"). "The same function called twice agrees with itself" cannot fail whatever the
function does; a literal can. **When that case fails, read the diff before touching it**: a key
reordered, renamed or dropped means every save in the wild re-writes on first load, and every open
chat gets one spurious rewind toast.

The literal has been updated **once, deliberately**: S5 slice 3 added the `player` block and nothing
else moved. That change is sanctioned because the alternative is worse — a pre-S5 save gains the
default block on its first write, costing one re-write per open chat, and a pre-S5 _build_ reading
that row deletes the block anyway (§11). Emitting the block conditionally to avoid the churn is the
slice-1 failure with a fresh coat.

Note the all-zero `world` stamps in the literal: a sim built by the CONSTRUCTOR has never been
rehydrated, and stamps are evaluated at rehydration only (§3). The first restore fills them, which
costs one further write on a chat's second boot and severs nothing.

For the same reason **`STARTING_PURSE` is not a default on the block.** A non-zero default `money`
would move the bytes of every save in the wild. The purse is granted through the mutators, on the
condition described in §7.3.

### 2.5 The size escape hatch

`dropCarry` is the pre-flight fallback, threaded from `snapshot()` down into `serialize()`. When a
snapshot will not fit the row cap, the FIRST thing dropped is a newer build's data — the world the
player is standing in outranks a block this build cannot read, and a build older than slice 1 wrote
rows with no carry at all, so dropping it is a return to the previous contract rather than new loss.
It is threaded into the _block_ serializer as well, because the block keeps unknown keys of its own:
a pre-flight that shed only the envelope's carry would leave an arbitrarily large foreign field
inside `player` with no escape hatch.

A slim write leaves the caches holding the slim bytes, so the next flush re-snapshots with the carry
and trips the pre-flight again. That is deliberate: the moment the foreign block shrinks back under
the wall it is carried again, and the cost meanwhile is one repeat write of bytes the server already
has.

### 2.6 Version, migration, and what `parse()` guarantees

The block carries its **own** version. An envelope bump would force a player migration that changes
nothing, and a player bump would invalidate envelopes that were fine.

`player.v` is **derived, never written twice**: `PLAYER_MIGRATIONS[i]` takes v(i+1) to v(i+2), so
`currentPlayerV() = PLAYER_MIGRATIONS.length + 1`, and an empty table is exactly "v1, and v1 is the
identity". A step and a version constant that can disagree is a bug waiting for its first migration.

`parse(raw)` **never throws** — a save path that can brick the surface is worse than one that loses a
block — and returns `{ player, source: "saved" | "defaults", quarantine: null | { slot, entry } }`,
where the caller owns the bag write. Its ladder:

| input                                   | result                | quarantine                                                                                            |
| --------------------------------------- | --------------------- | ----------------------------------------------------------------------------------------------------- |
| `null` / `undefined`                    | defaults              | none                                                                                                  |
| not an object (scalar, array)           | defaults              | none — a scalar carries nothing to recover, and there is no corrupt slot                              |
| `v` absent or not a positive finite int | defaults              | `migration`, `reason: "shape"`, `fromV: null`, block verbatim                                         |
| `v > currentPlayerV()`                  | defaults              | `version`, `reason: "too-new"`, `adoptable: true`, block **never parsed, never overwritten**          |
| a migration step throws                 | defaults              | `migration`, `reason: "throw"`, the step's **input** (not its half-migrated output), plus the message |
| a step returns a non-object             | defaults              | `migration`, `reason: "shape"`, block verbatim                                                        |
| otherwise                               | the block, normalized | none                                                                                                  |

The last row does the shape validation **by normalizing**: one pass through `serialize()` coerces
every field to its declared shape and drops what will not coerce, which makes "shape-validated" and
"byte-stable" one property rather than two. `player.v` is then set to the current version, and the
optional `bought` seam is restored to `null` so a mutator has somewhere to write (`serialize()` omits
an empty one).

**Version re-adoption.** A `version` slot written by an older boot is re-read on a later boot whose
`currentPlayerV()` has caught up: the slot is **consumed** (which is what makes a third boot a
no-op), the live block it displaces is parked in `setAside`, and a `stamp` entry from a different
lineage (`fromV` differs) is discarded, because it is not evidence about this one. Nothing but the
player ever resolves `setAside`: two live blocks cannot both be the player's state.

### 2.7 The row's `schemaVersion` column, and why `player.v` outranks it

A row carries its wire era **twice**:

- **in band**, as `state.player.v` — inside the block it describes;
- **out of band**, as the route row's own `schemaVersion` column (#5102, `z.number().int().min(1)
.max(1_000_000).default(1)` on the PUT, echoed on the GET).

Both write paths — the ordinary flush and the pagehide teardown — now send
`PF.player.currentV()` as the column, so every row this build writes agrees with itself. The column
exists for a reader that has **not parsed the state**: a future build triaging rows, or an external
tool reading an export, can tell which wire era a row belongs to without unpacking it. Checkpoints
capture `{ gameType, schemaVersion, state }` by value, so the era travels with a restored checkpoint
too.

**The in-band value is the authority and the column is corroboration.** The reason is which one
travels with the bytes: `player.v` is inside the block, so a row cloned to another anchor, restored
from a checkpoint, hand-edited, or written by a tool that never paired the two still reads at the
version it honestly declares. Nothing in the ladder or in `parse()` branches on the column —
`parse()` never even sees it. What the reader does do is **say so once per chat** when the two
disagree, naming which side won: a row whose column and block are out of step was written by
something that did not keep them in step, and that is a fact no other signal carries.

Two guards keep the column from ever costing anything:

- the transport **omits** it when the caller names none (so a call that does not care sends exactly
  the bytes it always did) and when the value is one the route's own schema would 400 on. A column
  nothing reads for correctness must never be able to take a save down with it.
- `schemaVersionOf` validates a read-back value the same way the route validates a written one.
  Absent, `null` (the GET's no-row shape), a float, a string — all of it is "the row does not say",
  which is no corroboration rather than a claim.

**This changes the PUT payload, not the state string.** The column is a sibling field on the request
body; the snapshot bytes are untouched, and the frozen literal (§2.4) does not move. A legacy row
stamped `schemaVersion: 1` — which is what every row written before this change claims, by the
route's default — carrying a modern block still resolves by the block's own `v`.

---

## 3. Stamps and severance

### 3.1 The three stamps

`player.world = { seed, briefHash, mintStamp }`.

- `seed` — the world seed, `>>> 0`.
- `briefHash` — FNV-1a over `JSON.stringify(sealedBrief)`. **An absent brief hashes to 0**, which is
  also what a legacy world stamps: the two are deliberately indistinguishable, because neither has a
  brief to change.
- `mintStamp` — derived by the compiler, never saved as content. `mintStampOf` (20-world) hashes
  `mint/v${MINT_V}` and then, per minted resident in mint order, `|${name}\0${kind}\0${household}` —
  the `|` prefixes every record and is part of the preimage, so two rosters cannot collide by having
  their fields run together across a boundary. Tints and wander flags are cosmetic and deliberately
  excluded: a change to them must not sever a save. What costs **zero save bytes is the ROSTER**, not
  the stamp: the stamp is persisted with the other two (`world.mintStamp`, 58-player `serialize`) and
  is exactly what makes the comparison possible without storing a single resident.

`MINT_V` is bumped when a change would hand the SAME seed and the SAME brief a different roster: a
new name book, a changed household-size distribution, a reordered kind table.

**Scope.** This machinery exists for exactly one case — a legacy save crossing a package update that
changed the mint. A new game always starts with an empty ledger; nothing here touches new games.

### 3.2 When stamps are evaluated at all

`stampsEvaluable(world, brief, briefExpected)` is `false` when there is no world, when the world is
`interim`, or when the brief is **absent but expected**. Severing against an interim world would
quarantine a save for a world that never was.

An unevaluated boot is not a no-op, though: if the world is interim and the held block is _bare or
already interim_, the block is marked `{ seed, briefHash: 0, mintStamp: 0, interim: 1 }`. Without the
mark, the next boot's `unstamped` branch adopts the throwaway save WHOLESALE into the compiled world
— relationship rows, quests and discoveries belonging to people the sealed brief never named. A
block carrying real stamps is evidence about a real world and keeps them.

### 3.3 The comparison

| held stamps                                                      | verdict                                                      |
| ---------------------------------------------------------------- | ------------------------------------------------------------ |
| none at all (pre-S5 save, fresh default), and not interim-marked | `unstamped` — stamp it and move on; nothing to disagree with |
| `briefHash` or `seed` moved                                      | **brief severance**                                          |
| only `mintStamp` moved                                           | **mint severance**                                           |
| nothing moved                                                    | re-stamp, no severance                                       |

**Brief severance** takes EVERY world-bound field — `rel`, `quests.active`, `quests.done_pack`,
`found`, `home`, `ledger.lines`, `bought` — into one `stamp` entry along with the stamps they
belonged to, clears them from the live block, applies the coupled `flushedDay` clamp, and records
both the old and the clamped gate (`flushedDayWas`, `flushedDay`). Notice: _"Some of what you had
done here belonged to another world. It has been set aside."_

**Mint severance** keeps everybody the brief NAMED and takes everybody else. The test is the
**complement of the brief's named cast**, not membership of the new world's `minted` list, and the
difference is the whole point: a resident the OLD mint produced and the new one does not is exactly
the row that has to go, and she is in **neither** list. The `minted` list only stands in when there
is nothing to name anybody with — no brief at all (a legacy world, whose mint is empty and whose
stamp moves only when `MINT_V` does), or a brief whose `cast` is not an array, which is the same
absence wearing a shape. Severed with the rows: active quests whose giver (the part of `g` after the
`|`) is minted. If the mint moved but nothing of the player's hung off it, the block is re-stamped and
**nothing** is quarantined — an empty entry would only cost a slot. Notice: _"Some of the people you
knew here are not the people who live here now."_

### 3.4 Restoration, and its invariant re-entry

`restoreStamped(player, entry, world, brief)` is the other direction: a `stamp` slot whose three
stamps match the world just built is a save coming home. All three must match exactly; otherwise it
returns `false` and the slot stays put.

- a **mint** entry MERGES: severed `rel` rows are unioned back per zone, severed quests are
  concatenated;
- a **brief** entry REPLACES: the whole world-bound set is assigned back, `bought` included.

Restoration then **discards nothing implicitly and trusts nothing**:

1. the `flushedDay` guard is re-applied against the restored lines, not carried over;
2. `_enforceCaps(player, liveQuests)` re-runs **every** cap and dedupe the mutators enforce —
   restoration is the one path that puts state back WITHOUT going through a mutator, so without this
   the block lands at twice the row cap with two copies of the same quest id in it. `liveQuests` is
   how many leading `active` rows came from the LIVE block, so the row the player is currently
   playing wins a dedupe outright and two parked copies fall back to whichever got further;
3. the result is normalized back through `serialize()` — the entry came off the wire and has to
   satisfy the same shape contract as everything else.

By design, world-bound fields written **during** the quarantine window are discarded on a brief
restore: the point of the window is that everything in it belonged to the wrong world.

### 3.5 Rehydration order

`_rehydratePlayer` (60-save) runs, in this order, and the order is the whole correctness argument:

1. **parse / migrate** (and park whatever `parse` hands back);
2. **version re-adoption** (consume the slot, park the displaced block in `setAside`);
3. **stamps / severance**, then the reverse direction — a `stamp` slot whose world is the world just
   built is restored and consumed;
4. **gated dangling-quest repair**;
5. **notices**, appended to the LIVE ledger's **band** (`ledger.notices`).

A repair run before severance would drop quests the severance was about to quarantine intact; a
notice appended before severance would be severed along with the lines it is explaining.

**Notices land at the day they happened, and that took the 0.12 format change to be able to say.**
They used to be ledger LINES, and a line at or below the flush gate is one the wrap-up skips — so
the day was shifted up to `max(sim.day, flushedDay + 1)` to keep the notice tellable, which put a
day header from the FUTURE into a wrap-up. The band answers to a **told flag** instead of to the
gate (§2.3, §8.3), so nothing has to lift a notice above anything: `sim.day` at write, full stop.
The old lines back-door and its day-shift are deleted, not deprecated.

There are **five notice writers**, and 0.12's copy review scoped itself to exactly those five
strings (maintainer amendment M3): the two severance sentences and the mint one (58-player
`applyStamps`), the dangling-quest loss (`repairQuests`), and the park-refusal and restore
sentences (60-save `_rehydratePlayer`). Each names **its kind's relationship to the player** —
a save coming home reads differently from a world that changed underneath somebody — because the
band is now a surface a player re-reads rather than one sentence in a wrap-up they saw once.
Naming an ACTOR (who changed the world) is beyond kind and is not possible in 0.12: no actor data
exists. The band's framing sentence is written to receive one when the roadmap's autonomous-change
mechanism arrives (ROADMAP L7).

The whole block is rehydrated **outside** the envelope's `saved.v` gate, exactly like the envelope
carry and for the same reason: a build that cannot read the envelope's version is the build most
likely to be destroying data it does not understand.

**The dangling repair is gated four ways** and is a **non-mutation** — it does not dirty the sim and
arms no write of its own; the next real save carries it. It refuses to act when the world is
interim, when stamps were not evaluated, when the world names no NPCs at all, and — the interesting
one — when **every** giver dangles, because that is a statement about the world rather than about
the quests.

### 3.6 The brief-arrival transplant (one release of compatibility)

`transplant(oldPlayer, world, brief)` is the pre-gate compatibility shim. A chat created BEFORE the
loading gate shipped boots on a throwaway world and rebuilds when its generated brief seals; that
seam carries the world-free half (`game`, `pouch`, `skills`, `quests_done_board`, and a newer
build's unknown keys) into the compiled world, parks every world-bound field in the `stamp` slot with
the stamps it belonged to, re-stamps the block for the world that just arrived, and runs the same
`_enforceCaps` + normalize re-entry restoration does.

The coupled `flushedDay` crosses too, and it crosses **clamped**: the lines it gates are going to
quarantine, so the transplant re-applies the same `min(flushedDay, minSeveredLineDay − 1)` guard
(§1.1) on the way over. A gate carried across intact would sit above lines that are no longer there,
and a restored line at or below it is one the flush would never tell.

`bought` does **not** cross. For a _gated_ chat the block is a fresh default and the split moves
nothing, which is the point: the safety net costs nothing once the gate has done its job. The path
retires one release after the gate.

---

## 4. The quarantine bag

`pixelforgeQuarantine`, its own top-level chat-metadata key. Written immediately at creation, three
attempts total with a 500 ms × attempt backoff (§4.4); **the in-memory bag is the authority** and the
key is where it is persisted. It gets its own `ensurePresent` branch because the two keys are written
by different code paths on different cadences, and the save key being intact says nothing about
whether the quarantine key survived the same whole-blob metadata write (~40 engine call sites still
use the unqueued whole-blob `updateMetadata`).

### 4.1 Four slots

| slot        | written by                                                                 | restored by                                                                            | cleared by                                                                                    | multiplicity                                |
| ----------- | -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- | ------------------------------------------- |
| `migration` | a block whose `v` will not read, or a migration step that throws           | a later build whose fixed step migrates it cleanly                                     | restoration, or explicit discard                                                              | one; **first loss wins**                    |
| `stamp`     | world-identity mismatch at rehydration (§3.3), and the pre-gate transplant | stamp re-match on a later boot (§3.4)                                                  | restoration; explicit discard; invalidation by a version re-adoption with a differing `fromV` | one; **merges**                             |
| `setAside`  | the live block displaced by a version re-adoption                          | **never by machine** — HELD for a human to resolve                                     | explicit discard                                                                              | a **list**, bounded at 4, oldest shed first |
| `version`   | a too-new block (`adoptable: true` at write)                               | re-adoption by a build whose `currentPlayerV()` has reached `fromV`; consumes the slot | the re-adoption itself                                                                        | one; **first loss wins**                    |

"Never by machine" is the whole of `setAside`'s restore contract today: **0.11 ships no resolution
surface**, so the slot is held, bounded and readable through `peek`/`consume`, and nothing in the
package offers it to anybody yet. Holding it is still the point — two live blocks cannot both be the
player's state, and only the player can say which one they meant — but the UI that asks them is a
later slice, and until it lands the entry is inert rather than visible.

There is no `corrupt` slot. A row whose stored text will not parse is unrecoverable client-side; the
raw text is parked separately as _evidence_ (§5.4), not as a backup.

### 4.2 First-loss-wins versus the stamp merge

`migration` and `version` are first-loss-wins: the first thing either slot lost is the one furthest
from being recoverable any other way, and a later loss of the same kind is a repeat of the same
cause. `put()` returns **`false`** in that case and **no caller may drop that on the floor** — the
whole bug class here is one unread return.

`stamp` is the exception and it had to be. It was one-shot too, and that was a data-loss bug with a
lie on top: `applyStamps` STRIPS the live block before offering the entry, so a second severance
found the slot full, got `false`, and deleted everything it had just stripped — while still telling
the player it had been set aside. Severance parking is now lossless while the bag has room.

The merge (`mergeStampEntries`) keeps the **held** entry as the anchor — its stamps, its reason, its
`at` — because the first loss is the one a returning world is matched against. Only the FIELDS
merge, each the way its own shape means:

| field                         | merge rule                                                                     |
| ----------------------------- | ------------------------------------------------------------------------------ |
| `rel`                         | union per person; the higher `d` wins, then more encounters, then the held row |
| `questsActive`                | concatenated, deduped by id, the further-along copy winning                    |
| `questsDonePack`, `bought`    | union, the higher count winning                                                |
| `found`                       | union by the composite `(p,e,d)` key, bounded by the `found` cap               |
| `ledgerLines`                 | concatenated, newest kept, bounded by the live buffer's own caps               |
| `home`                        | the held one — two homes are not a home                                        |
| `flushedDay`, `flushedDayWas` | the LOWER gate: whatever comes home must not land at or below it               |

A field only one side carries crosses untouched, and the merged entry counts itself
(`mergedCount`).

`setAside` appends rather than merging, because it is the one HUMAN-resolved slot: a second
displaced live block is a second thing to offer the player, not a repeat of the first. Its overflow
sheds the **oldest** — the newest displacement is the one they are most likely to still want back.

The four slots stay independent: a full `version` slot must not silence a `migration` loss.

### 4.3 Overflow, and the tripwire

The bag has its own ceiling, `QUARANTINE_MAX_CHARS = 131,072`. It lives in its own metadata key and
competes with nothing, so this is a **tripwire against a pathological blob bloating the chat's
metadata**, not a size allowance to fit inside. At any realistic severance size it never fires; it
stays because it is the tripwire's mechanism, and because "held" has to mean held.

Two mechanisms, in this order:

1. **fit-check before mutating.** `put()` refuses an entry that cannot be held even alone, with the
   bag untouched. The old order ran the drop loop after the fact, so an oversized entry spent every
   OTHER slot on its way to being dropped itself — while `put` had already returned `true`.
2. **the drop order at serialize time**, least-recoverable first:
   `setAside < stamp < migration < version`. `setAside` goes first because nothing else in the bag
   is waiting on a machine to hand it back. Ahead of the order, any single slot that no longer fits
   even alone is dropped first whatever the order says; keeping it costs every other slot and buys
   nothing. Two things put one there: a stamp merge growing an entry past the ceiling, and a bag read
   — `hydrate`'s `readBag` checks each slot's SHAPE and nothing else, so a key a hand-edit or a
   foreign writer left oversized arrives straight off disk at whatever size it is. `setAside` sheds
   its list oldest-first before the slot itself goes. Every drop warns.

`_serialize()` mutates the bag rather than only the output: a slot that cannot be stored is not
being held, and pretending otherwise would report a recovery that cannot happen.

### 4.4 One writer, and the unsettled map

Every bag write goes down **one** promise chain (`_writeChain`), the same arrangement
`PF.save._flushChain` makes for the snapshot and for the same reason: the writes used to be
`void this._write(...)`, each with its own retry loop, and a version re-adoption fires THREE of them
in one synchronous stretch. Nothing ordered them, so a retried write could land last and put an
invalidated slot back on disk, or erase a park that memory still held.

Two structures hold that together:

- **`_pending = { id, holder }`** — the write queued but not yet running. A second request for the
  same chat refreshes the holder rather than adding a round trip that sends the same bytes twice.
  **The holder is bound to the TASK, not to this object**: `reset()` must clear the pointer (or task
  A writes chat B's bytes), and when the payload lived in a field the queued task read at run time,
  clearing it left that task reading `null` — so the severance parked at the moment of leaving a chat
  never reached that chat's disk. `reset()` now clears the pointer and the departing chat's task
  still holds the box it was given. `_writeChain` itself is deliberately **not** cleared, exactly as
  `_flushChain` is not: the departing chat's write rides it and must land before the arriving chat's
  first one.
- **`_unsettled: Map<chatId, bagBytes>`** — bag bytes produced for a chat that are NOT known to have
  reached disk: queued, in flight, or failed out. Recorded from the moment the write is _asked for_,
  cleared by `_writeNow` only for the exact bytes it actually wrote (a `put()` that landed while the
  PATCH was in flight has already recorded newer bytes and queued its own write). Kept across
  `reset()` on purpose, and deliberately **not** cleared when a write fails out: an entry nobody
  managed to store is precisely the one worth re-trying on the next visit.

  The holder alone is not enough, and the case that proves it is a two-chat round trip inside one
  un-drained chain. Park something on chat A, glance at B, come back to A before A's queued write has
  run: `hydrate()` rebuilds the bag from DISK — which does not have the park — and sets the dedupe
  cache to those bytes; the queued task then wakes, re-serializes the live (disk) bag, and the dedupe
  says "already stored". The write is dropped and the park is gone from disk AND memory, on the one
  path most likely to have produced a park in the first place. So `hydrate()` **prefers** an unsettled
  entry for that chat over the disk read, and asks for the wire again when the adopted bytes differ
  from what disk holds. `_bagSerialized` keeps meaning exactly what it always meant — **what we
  believe DISK holds** — which is why the comparison is against disk's bytes rather than against what
  was adopted.

  **The map is bounded, and the bound is not a cap.** `UNSETTLED_MAX = 8` is the size past which
  `_write` starts shedding, and the only record it will shed is one **disk is known to hold**:
  `_settledRecord(exceptId)` is narrower than it sounds, because `_bagSerialized` records what we
  believe disk holds for the LIVE chat and for no other chat at all — so "known to hold" is a
  question that can only be asked about `_chatId`'s own record, and a record for any other chat is
  never a candidate whatever its bytes say. What that leaves is one real case: a write asked for on a
  different chat while the live chat's record is already stale, which is exactly the state `_writeNow`
  leaves behind when it returns early on bytes that match the dedupe cache. When there is nothing
  settled to shed, **the map carries the overflow rather than the loss** — every other entry in it is
  by construction a write nobody managed to store, so evicting one silently re-opens the park loss the
  map exists to close. This is the identical fork `_briefCache` answers identically (§6.5), and the
  alignment is deliberate: both are per-session maps of small byte strings in which each entry is the
  sole record of something a later visit needs, and the two code sites name each other. What the map
  is really bounded by is how rare "quarantined something AND failed to store it" is per chat.

`_writeNow` re-reads the bag on **every** attempt while the chat is still live: a retry that lands
500 ms later must carry what the bag holds now, not the snapshot the first attempt froze — that
snapshot is how a retried write resurrected a slot a later `consume()` had already cleared. Once the
chat has moved on, the captured bytes are what that id is owed. Three attempts, 500 ms × attempt
backoff; after the third the bag stays authoritative in memory and `ensurePresent` re-tries it on the
next props delivery.

### 4.5 The reader contract

`peek(slot)` and `consume(chatId, slot)` return **the same thing**: for `setAside`, the OLDEST entry
of the list, leaving the rest in the bag. This is stated because it was not true — `consume` used to
return `setAside`'s list wrapper while `peek` returned an entry, so the one slot a human resolves one
item at a time was the one slot whose two readers disagreed. `peekAll`/`consumeAll` are the bulk
mirrors. `discard` drops a slot without reading it. `hydrate` is called **once per chat**, from
`PF.save.restore` and deliberately not from `simFromSaved` — which also runs on every rebuild and
would resurrect a slot a re-adoption had just consumed.

---

## 5. The GET decision ladder

One implementation (`PF.save.classify`), three consumers, and a fourth derived from it. Every site
used to ask its own version of "is this row mine, and is it newer than what I hold?", and they
disagreed: adopt compared against the local snapshot, `checkRewind` against the last known row, the
flush against nothing at all, and teardown against a byte cache.

The rows are evaluated **in order** and the first match wins. The result carries the row, the parsed
state, and a per-site action map, because the same row means different things at different sites.

### 5.1 The rows

| #   | name                 | adopt       | rewind | flush     | anchorCache | says                                                                             |
| --- | -------------------- | ----------- | ------ | --------- | ----------- | -------------------------------------------------------------------------------- |
| 0   | `unavailable`        | metadata    | none   | proceed   | no          | 404/409 — the route is not here. A MODE signal, not a state of the row           |
| 1   | `unparseable`        | repair      | ignore | proceed   | **no**      | the row is damaged; the next write IS the repair                                 |
| 2   | `foreign-game`       | ignore      | ignore | proceed   | **no**      | the row belongs to a game ordinal the player retired                             |
| 3   | `first-write`        | first-write | none   | proceed   | no          | no row at this anchor and we never had one                                       |
| 4   | `lost-row`           | first-write | reread | **block** | no          | we held an anchor and the row is gone — the timeline rewound past our first save |
| 5   | `own-commit`         | ignore      | ignore | proceed   | no          | this row predates a write of ours                                                |
| 6   | `differs-unanchored` | rebuild     | latch  | proceed   | yes         | the row differs from our own metadata-booted snapshot                            |
| 7   | `differs-anchored`   | rebuild     | rewind | **block** | yes         | the row differs from an anchor we held: the timeline moved                       |
| 8   | `same`               | none        | latch  | proceed   | yes         | byte-identical                                                                   |
| 9   | `get-failed`         | none        | none   | fresh     | no          | the probe did not answer                                                         |

Rows **1 and 2 must never become `_serverSerialized`**: a damaged row and a retired game's row are
both things we are about to overwrite, and treating either as "what the server holds" would make the
next honest difference look like a rewind.

Row 6 is the one row whose message differs by site: a mid-session difference is latched in **silence**
(nothing visibly changed), while the same row at BOOT means the world the metadata just built is
being replaced under the player, which is the one time they need the sentence. The ladder therefore
carries both `toast` (rewind check) and `adoptToast` (boot).

Row 9 is classified **separately** and never consumes the PUT ladder's ceiling: a probe that did not
answer is not a write that failed, and spending a backoff rung on it would take the session's saves
down with the network's bad minute. It has its own bounded ladder (`_rearmRow9`), same rungs, same
give-up point.

Row 2 is **total by construction**: a row with no player block, or one whose `game` is not a finite
number, reads as game 1 — which is what every row written before S5 is. Older-game rows are inert at
every site and are **retained**; deletion and export are the player's explicit choice through the
engine's management verbs.

Row 4 always gets **one** re-read before it rewinds: a GET landing inside the PUT route's
delete-then-insert window finds no row at all and would otherwise rewind a perfectly live world back
to its baseline, toast and all. The pre-check decides on the row that is actually there after that
re-read, not the one it was handed.

Every decision also carries `rowSchemaVersion` — the row's out-of-band wire era (§2.7) — for a
caller to read. It is null on rows 0 and 9, which have no row to describe, and **no value of it
moves a verdict**.

### 5.2 The #5406 ordinal seam

The engine FR stamps every experience row and every metadata key from ONE per-chat monotonic counter
(GET and PUT both report `writeOrdinal`; the metadata side is mirrored at
`metadataWriteOrdinals[<key>]`). **It is better evidence inside the rows above and never a row of its
own.** It is read in exactly two places:

- **row 5.** The own-commit gate is unchanged — "a PUT of ours completed while this GET was in
  flight". `_writeSeq` cannot say WHICH row that PUT landed on, so the suspicion was unfalsifiable
  and a perfectly current row was discarded whenever a write happened to overlap a read. A row at or
  past our own last PUT's ordinal already CARRIES that write, so the classification falls through to
  the byte comparison instead.
- **rows 6/7/8.** The byte comparison still picks the row. The ordinal answers the one question bytes
  cannot: where the baseline is our own metadata-booted snapshot (row 6's precondition, no anchor of
  ours), is the row AHEAD of that cache or BEHIND it? A row strictly behind the mirror's entry for
  our key is provably older than the world we are standing in, and adopting it would throw away a
  degraded session's entire play. That case classifies as **row 5**, whose meaning it already is.

**The anchor outranks the ordinal, and that half is load-bearing: the ordinal orders the STORES, only
the anchor orders the TIMELINE.** The mirror test therefore fires only when the engine says the row
is NOT the reader's own anchor's save (`anchorMatched !== true`). Without that guard a swipe-back
taken while the tab was closed would stop rewinding the world — because a healthy flush ALWAYS leaves
the mirror one ordinal ahead of the row it paired with, the row being written first.

A **tie is the same write**, not a newer one, so both tests compare strictly. Either side
unorderable — a pre-#5406 engine, a row cloned from before the feature, a mirror clobbered by a
whole-blob metadata write — and every branch falls back to exactly the byte ladder that shipped
without it. `ordinalOf` accepts only a positive safe integer, deliberately the same validation the
server's own mirror reader applies: a client that accepted a value the server ignores would order its
writes against a number nothing else agrees with.

**The residual the seam does not close** (§11): a degraded session that sent NO narration leaves the
anchor unmoved, so the row comes back with `anchorMatched: true` and the anchor guard hands it the
world. The ordinal cures only the anchor-_moved_ degraded case. This is unchanged from pre-seam
behaviour, and accepted.

**Status.** #5406 and #5407 are **merged to Engine `staging`** (#5407 via PR #5411, merge
`ac353645`; #5406 via PR #5417, merge `d32ebe9dd`; #5405's save-management verbs via PR #5416,
merge `d561f3400` — all 2026-08-22/23) but are **not yet in a tagged Engine release**. This
package's `builtAgainst` is 2.4.3, which predates all three, so on a current install the route
reports `anchorMatched` but neither `writeOrdinal` nor `rawState`, every reader above is dormant,
the byte ladder decides, and row 1's legacy inference (below) stands in for `rawState`. Nothing
has to change here when the next Engine release ships the fields — the readers go live off their
presence alone.

### 5.3 The freshness clocks

There are **two** clocks and conflating them was a bug.

- `_lastCheckAt` — when the last check **answered**. This is what the flush pre-check's skip window
  measures: the GET is skipped while the last check is inside one debounce window (`CHECK_FRESH_MS`,
  2500 ms), because the pre-check exists so a PUT never lands on a row nobody looked at, and the
  turn-edge check that ran a moment ago looked at it. Without the skip every save costs two requests
  on a route that re-serializes the chat's whole shard.
- `_lastOkCheckAt` — when the last check found the row **writable** (`flush === "proceed"`). This is
  what row 9's freshness means. A row-4 check answers — so it moves the first clock — but it found
  the row GONE. With one clock, an unresolved lost-row check made the very next teardown look fresh
  and ship a full-snapshot overwrite on the strength of it.

An **echoed anchor move** cancels freshness outright at both sites: whatever we last saw, we did not
see it at the anchor this write would land on. `_noteAnchorEcho` records the ordinal _before_ the
anchor guard, because a route that answered without an anchor still told us which ordinal our row was
given.

### 5.4 The teardown clean-gate

`_teardownAllowed()` is **derived from the ladder rather than guessed at**. Only rows 4 and 7 block —
the two that say the timeline moved and our snapshot is the stale one. Three further rules:

- **metadata mode has no row in the ladder**, so it is always allowed. A boot probe that failed both
  picked the mode and left a row-9 `_lastCheck` behind, and that row 9 with no successful check to
  measure against then refused every teardown write for the rest of the session — in a mode where the
  only store is a metadata key the PATCH owns outright and no anchor can move under.
- **never having checked at all is a PROCEED**: that is a fresh chat, and its first write is the
  row's creation.
- **row 9 blocks once its freshness lapses**, measured against `_lastOkCheckAt` and cancelled by an
  anchor move. A probe that failed thirty seconds ago says nothing useful about the row, and a
  keepalive PUT is the one write nobody gets to take back.

The teardown path itself (`flushTeardown`) does not queue behind `_flushChain` — an ordinary flush
sitting mid-await would swallow the last write of the session — and cannot afford a GET of its own,
so it spends the last check's verdict instead. It fires both keepalive requests without awaiting
between them, and sizes the pair against the keepalive quota (§10).

**The damaged row's text.** A row-1 classification at ANY site means the next write repairs the row
and destroys the only copy of its bytes, so the park is hoisted out of boot and called from every
site that sees the classification — boot adopt, the turn-edge check, the flush pre-check. It is
bounded at 4,096 chars under `pixelforgeCorruptExcerpt`, first-park-wins, and it is **evidence for a
bug report, not a backup**: nothing client-side can turn it back into a world. The next healthy adopt
nulls the key again. The _telling_ is separate and deliberately not every site: the turn edge repairs
nothing and nothing visible changed there, so it stays silent.

Row 1's detection has two arms. Engine #5407 would hand the raw stored text back on the failure path
only, so the PRESENCE of `rawState`/`stateUnparseable` is the corruption signal — that is what keeps
a damaged row distinguishable from a legitimately stored `null`. Today's engines ship neither, so the
legacy inference stands in: we only ever PUT a shaped object, so exists-with-nothing-shaped can only
be damage.

---

## 6. The loading gate

**A generate-configured chat does not enter play until its brief is sealed.** The maintainer rejected
the interim playable world outright: a player must never invest in a world that is going to be
discarded. A long loading screen is the accepted cost.

`PF.save.gate` is `null` while the chat plays, otherwise
`{ chatId, state: "generating" | "failed", attempts, failure }`. It is chat-scoped twice over — by
`reset()` and by the id it carries — because a stale async completion must not lift or fail the gate
of the chat you arrived at.

### 6.1 Who arms it, and who never does

`armGate(core, meta)` is called once per chat switch and **before** `adopt()`, because adopt's row-3
action is `first-write` and probing a gated chat would write the un-entered world up as if it were
somebody's play. It arms only when `briefExpected(meta, chatId)` — one predicate with four consumers
(the interim mark, the stamp-evaluability gate, the gate itself, and the nothing-to-generate branch
§6.3 describes), because separate copies of a predicate this load-bearing is how they come to
disagree about which chats are which.

Never armed: legacy chats, non-generate chats (default worlds by design), and a chat whose generation
was **declined** — its `{ skipped: true }` marker reads as "sealed enough".

### 6.2 What it holds

Every refusal asks `gateHolds(core)`, never `gate !== null`:

| site                                                  | what it refuses                                                                                                                                                  |
| ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `PF.player._live`                                     | **every mutator at once**, including ones written after the gate; each verb returns its documented refusal value                                                 |
| `PF.save.markDirty`                                   | the debounce timer itself — a world nobody is playing should cost no wakeups                                                                                     |
| `PF.save._pendingWrite`                               | the debounce, the retry ladder, the chat-switch capture and the last-detach flush, at the one chokepoint all four pass through                                   |
| `PF.save.flushTeardown`                               | the pagehide pair — closing the tab mid-generation must not stamp the placeholder into the row store on the way out                                              |
| `PF.save._adoptNow`                                   | the probe                                                                                                                                                        |
| `PF.save._checkRewindNow`                             | the turn-edge check (belt and braces: a gated chat never reaches routes mode)                                                                                    |
| the frame loop (90-element)                           | the step, the clock and the draw — a sim that stepped behind the panel would age a world nobody is in and burn the cutscene beat before the player saw the place |
| `interact()`, the key handler, the chrome declaration | talking, walking, and the player-input claim                                                                                                                     |
| the HUD                                               | everything below the panel; the topbar is hidden and the gate's own `state` drives the copy                                                                      |

### 6.3 Lifting, failing, retrying

`_liftGate` **refuses to lift onto an interim world.** The gate's whole promise is that nobody plays a
world that is going to be discarded, and the placeholder is exactly that world — everything done in
it stamps `{ briefHash: 0, interim: 1 }` and is severed unrecoverably the moment the real world
compiles. Every caller's job is therefore to REBUILD first and lift second; the refusal is the
assertion that keeps a future caller from quietly re-opening the hole. `adopt()` runs from the lift
rather than from the chat switch, because it is the first thing allowed to write.

`_installSealedWorld` is everything that happens once a sealed brief is in hand: compile, carry the
envelope extra and split the player block across the seam (§3.6), park whatever was severed, lift,
pay the purse, toast _"The world takes shape."_, mark dirty. **The gate lifts BEFORE the first dirty
flag and the order is load-bearing** — `markDirty` refuses while the gate holds, so arming the save
first would arm nothing.

It has a second caller, and the absence of that second caller was a bug: every throw the generation
guard was written for lands AFTER the brief is stored and cached, so by the time the player presses
"Try again", `briefExpected()` is already false and the retry takes the nothing-to-generate branch.
That branch used to lift the gate bare, which started play IN THE PLACEHOLDER. It now recompiles from
the brief that is already sealed and lifts onto that.

`_failGate(core, kind)` sets `state: "failed"`, increments `attempts`, and records the ladder's own
verdict so the retry screen can say something truer than "something went wrong". `gateReason(kind)`
maps `refused | unavailable | network | timeout | storage` to one sentence each, with an honest
generic for an absent or unknown kind — a throw has no verdict to report, and a kind a newer ladder
invents must not blank the panel. `"refused"` earns its own sentence: a deterministic 400/422 gives
the same answer every time, and a player pressing a button that will never work deserves to be told.
**The per-kind sentences** live in `60-save.js`, not in the HUD, for the reason every other decision
in that module does: the HUD needs a DOM and the harness has none, so a string that has to be pinned
lives where it can be. The chrome AROUND them is the HUD's own and is not pinnable: the retry
screen's title ("The world didn't finish being written.") and the trailing paragraph after
`gateReason` are hard-coded in `70-hud.js`.

`retryGeneration(core)` is the only caller of the retry button; everything else re-arms by revisiting
the chat.

### 6.4 No failure seals a world

**Only the two outcomes that produce a real brief seal one: success and salvage.** Every other
outcome leaves the chat **unsealed**: the key stays absent, the gate shows a retry screen, and the
next visit arms it again. The ladder splits those outcomes two ways, and only one side is a list.
**Transient** is the enumerated set — 404 route-absent, 409, 429, any 5xx, a network error, the
budget timeout — and it is complete as written. **Deterministic is the FALL-THROUGH**: everything
that is not in that set lands in `"refused"`, which is the 400 contract failure and the
`provider_error`/parse-failure 422 the branch was written for, but also a 401, a 403, and any status
a future engine invents. That is deliberate — a status this build cannot place is one it should not
promise to retry — but it means `"refused"` is a catch-all, not a second enumeration.

This is a revision. The 0.4.0 ladder sealed the themed default world on a deterministic or paid
failure, reasoning that a paid call per visit is worse than the default world. That decision predates
the gate, which now holds play precisely so nobody invests in a world that is going to be discarded —
so sealing a default is no longer "the world they were already walking in", it is a permanent
decision made on the player's behalf in the one case they cannot undo. The `userContent` clamp
(cut at 7,800 chars against the route's 8,000 — the sent payload is 7,801, because the ellipsis is
appended after the slice) also makes a reachable 400 a contract bug rather than a long setting. The
cost is accepted by choice (§11): a generation failure blocks play behind retry instead of degrading
into a sandbox.

### 6.5 Escape safety

Two caches keep the gate from re-generating a world that already exists.

- **`_generating`** is a SET keyed by chat id, not a flag. With a flag, leaving a chat mid-generation
  left the flag up and the chat you arrived at sat behind a gate with nothing running behind it. The
  stored key (sealed brief or skipped marker) remains the one-shot guard **across** visits.
- **`_briefCache`** (chatId → sealed brief, cached BEFORE the chat fence). A generation that lands
  while the player is in ANOTHER chat cannot patch that chat's `host.chatMeta`, so without the cache
  the next visit reads a chat that still looks unsealed, generates a SECOND time, and the player gets
  a different world than the one already stored. `_configBrief` consults it **last**, only when the
  metadata carries nothing at all about a brief: anything the host actually delivered — a sealed
  brief or a `{skipped:true}` marker — is the newer truth.

  **Eviction is not free here**, which is why the bound is not a plain drop-the-oldest. Only entries
  the metadata has been _observed_ to carry (`_briefSeenInMeta`, recorded by `_metaKnows`) are
  droppable; when none of them is, **the cache carries the overflow rather than the loss**. What it
  is really bounded by is how many chats one session can have sealed-but-not-yet-acknowledged at
  once, which is a handful of a few KB each. `PF.quarantine._unsettled` answers the identical fork
  identically and for the identical reason (§4.4); the two code sites name each other, and a change
  to either bound belongs in both.

`reset()` clears the gate but deliberately clears neither `_generating` nor `_briefCache` (nor
`_briefSeenInMeta`, which rides with the cache it describes): a generation in flight for the chat
being left must still seal, and the brief it seals is what stops the next visit generating that world
all over again.

### 6.6 The purse is a property of state, not of an instant

The starting purse is paid on **every** path a sealed world arrives by — `_installSealedWorld` and
`armGate` both ask — and `grantStartingPurse` is idempotent by its own predicate, so a chat already
paid is untouched by the second call. It used to be paid at exactly one moment (the tail of the
generation that sealed the brief) and every ordinary way of not being there for that moment cost it
permanently: leaving the chat while generation ran, a reload between the seal and the lift, or a
throw that turned the lift into a retry screen.

**Sealed worlds only.** A default world is not a world beginning — it is the world that has always
been there. That is what keeps the purse off every legacy and declined chat, and what makes two chats
standing in the identical default world hold the same money whichever door they came through.

---

## 7. The economy vocabulary and the verbs

Everything in `59-economy.js` is content plus a set of game-facing entry points, and **every one of
them comes in a pair**: an OFFER that describes and never charges — so the HUD can call it on every
frame and render a refusal instead of hiding a control — and a VERB that mutates. 0.11 shipped one
such pair (`berthOffer` / `rentBerth`) plus `grantStartingPurse`; 0.12 added three more
(`fishOffer` / `fish`, `rodOffer` / `buyRod`, `sleepOffer` / `sleep`). The rest of the module —
`_skin`, `currency`, `money`, `describe`, `price`, `verbSkin`, `playerLabel`, `catchTable` — is the
vocabulary those pairs and the HUD read through.

**The module holds no state of its own**, which is unchanged and is what makes the whole surface
rewind-safe: everything durable goes through a shipped mutator (`award`, `grant`, `take`, `equip`,
`setHome`, `log`, `bump`, `flush`) and lands in the player block, which rides the route-anchored
snapshot. A verb that kept a counter would be a second writer nobody rewinds.

**Why the verbs live here rather than in 58-player.** 58-player is the state BLOCK and deliberately
ships no verbs; 30-sim loads before both and can see neither. A verb is content plus an offer plus
a sequence of mutator calls, which is precisely the shape `rentBerth` already had — so fishing went
beside it rather than inventing a fourth home.

**Two 0.14 surfaces sit at the end of this section and are not economy** — §7.9, the sky and the
calendar, and §7.10, the dialogue window. They are here rather than in a new top-level section for
one reason worth stating instead of leaving a reader to wonder: §10, §11 and §12 are cross-referenced
by number from the roadmap, from `docs/brief-schema.md` and from this document's own commit history,
and inserting a section above them would silently move all three. The subsection numbers are cheap;
the top-level ones are not.

### 7.1 Items, skins, prices

A pouch row is keyed `(t, k)` — type and **either** quality or variant. **`t` has to mean the same
thing in every theme** or a save crossing a theme change would be renaming the player's belongings,
so the TYPES are shared (`ITEM_TYPES`) and only the **skin** — the display name, the glyph, and
what the world calls its money — is per theme.

`ITEM_TYPES` is `["lodging-key", "rod", "bait", "catch-common", "catch-uncommon", "catch-rare",
"catch-prize"]`. **The `k` field carries two different vocabularies and they must not share one
validator.** For a TOOL — the named set `PF.player.TOOL_TYPES`, currently just `rod` — `k` is a
rung on the frozen `QUALITY` ladder and `grant()`/`equip()` refuse anything off it. For everything
else `k` is a **semantic slug**: a catch's variant (`carp`, `culture-kelp`), a bait's kind
(`worms`, `chum`). A slug is not a worse `"crude"`, so the grading rule is scoped by type and every
other row's `k` is left free. Row identity is `(t, k)`, so a kelp never merges into a carp.

| theme           | currency              | `lodging-key` | `rod`       | `bait`     | berth | rod: crude / decent |
| --------------- | --------------------- | ------------- | ----------- | ---------- | ----- | ------------------- |
| `cozy-village`  | coin / coins, `◍`     | room key      | fishing rod | hook bait  | 12    | 6 / 40              |
| `sci-fi-colony` | credit / credits, `◈` | berth chit    | angling rig | lure stock | 12    | 24 / 40             |

The four catch roles are skinned too (`catch` / `good catch` / `rare catch` / `prize catch` in the
valley; `haul` / `good haul` / `rare haul` / `record haul` in the colony), but a catch row in
ordinary play never renders through its role: the variant name wins, a variant no theme knows falls
to its own slug with hyphens and underscores turned into spaces, and the role skin appears only for
a row carrying **no `k` at all**.

`money(world, n)` renders `1 coin` / `12 coins` so a sci-fi colony never charges anybody "coins".
`describe(world, item)` has **two mechanisms, split by type**: a TOOL renders as `${quality} ${name}`
("crude rod"), while a catch or bait row keys its name on the VARIANT (`carp` → "carp"), because
the tool spelling would otherwise render "worms bait". Over both sits a seeded display override
keyed `(seed, t, k)` uniformly, with the skin name as its fallback — so a world can call its carp
something of its own and every surface that renders through `describe` agrees. An UNKNOWN type
still renders as its own tag with hyphens AND underscores turned into spaces, carrying the quality
prefix — `{t:"warp_core",k:"fine"}` reads "fine warp core" — and an unknown VARIANT renders
slug-derived by the same rule, so a newer build's row is a display fact rather than a hole. A row
with no usable `t` at all is the one case that renders as `""`.

**A verb has a skin too** (`verbSkin`), because a slot label is a name like any other: fantasy
fishing equips a `rod` and a `bait`, the colony's *angling* equips a `rig` and a `lure`. So does
the player (`playerLabel`) — "Traveler" in the valley, "Drifter" in the colony — which the
character sheet captions its portrait with, because the package has no player name and the host
props expose none (§8.5).
`price(world, what)` returns **`null`**, never a default number, when a thing is not for sale here: a
caller that cannot find a price must refuse the sale, not invent one.

Every table read **whose key can come off a save is own-property only**. `world.theme` and a pouch
row's `t` are exactly that, and a nullish-coalescing lookup never reaches its fallback for
`"constructor"` — the prototype answers with something non-nullish and the call TypeErrors instead of
quietly rendering in the default theme's words. Two reads in the module are deliberately bare, and
both are safe by where their key came from: the load-time completeness assertion below indexes
`ITEM_SKINS`/`PRICES` by a theme id it got from this build's own `PF.art.themeIds()`, and
`rentBerth`'s `world.zones[offer.zoneId]` uses a key `berthOffer` already `hasOwnProperty`-checked
before it would hand back an available offer.

A load-time completeness assertion (in the placers' idiom) requires **every shipped theme** to skin
every item type, name its own money, and price a berth. The fallbacks above are there for a SAVE
naming a theme this build dropped, not as a licence to ship a live theme unnamed. **0.12 widened
it considerably, and the widening is the shape of the whole surface**, so it is worth reading as a
list of what a new theme owes:

- **every price key any verb can quote** — the berth and **each rung of the rod ladder** — because
  `price()` answers `null` for "not for sale here" and a rod the build means to sell and forgot to
  price is indistinguishable, at play, from one it deliberately does not stock. **Key existence
  only:** nothing couples a price to the purse or to the berth (maintainer override — income
  arrives in later releases and berth-sleeping is optional), so the build insists a quotable rung
  is quotable and never that it is cheap;
- **the player's own word** (`playerLabel`) and **every skill verb with both slot words**, because
  the character sheet renders them and nothing else does — a theme missing either shows a blank
  caption under the portrait, or the raw block key where the skill's name goes;
- **the no-rod hint, and that it contains its `{role}` slot**, which is what keeps the sentence
  from hardcoding an innkeeper into a colony (§7.6);
- **the full 2×2 of catch tables** — both spot kinds, non-empty, since an empty table is the same
  hole with a shape and would divide by a zero weight rather than refuse — plus per-entry checks
  that a role is a role, a variant has a slug with no `:` in it (the ledger's own separator), a
  weight is positive, a `minLevel` is inside `1..CAPS.skillLevel` (above it is content no save can
  reach), and every daypart column is one of the four real dayparts;
- **a name for every variant ANY shipped table mentions, in every theme** — the union, not each
  theme's own list, because the pouch is world-free and a carp caught in a valley is still in the
  bag when the same chat's next world is a colony;
- **at least one bait entry per theme**, since the first rod purchase throws in a starter stack of
  the theme's first bait slug and a theme with none would sell a rod and hand over an empty tin.

Three more assertions sit outside the per-theme loop, on the tuning table itself: `catchXp` names
every yield type (a missing one is a yield that awards nothing, silently, and the likeliest missing
one is `bait` — the first thing a new player catches); `toolMult` is exactly as long as `QUALITY`
(two lists in two files indexed by the same resolved number, and a short one hands `undefined` to
the curve — NaN chance, on the best rod in the game); and `ledgerTellChars` is at or above one
maximum-shape ledger day, which §8.4 explains.

The fixed price lists are a first step. The plan's weekly deterministic stock tables need L2's
calendar and arrive with it; a table lookup replaces the constant and the verbs do not move.

### 7.2 The berth: the contract

`berthOffer(core)` **describes only** — it never charges anything, so the HUD can call it every frame
and a caller can render the refusal instead of hiding the button. It returns
`{ available, reason, keeper, zoneId, price, home }` with `reason` one of `no-keeper`, `no-lodging`,
`not-for-sale`, `no-player`, `already-yours`, `cannot-afford`. **The offer follows the PERSON _and_ the
ROOM**, in that order. Reach is tried first: `npc.lodging` is stamped on the keeper of the settlement's
gathering, so an innkeeper standing in the square at noon can still let you a room, which is what a
keeper is. Failing that, `_keeperInRoom` resolves the keeper from the zone's own `lodging` mark, so
walking into the inn offers the berth even when somebody else is the nearer body — which is how a
player who never brushes past the keeper finds the room at all. **Both paths were extracted into one
shared `_keeper(sim)` helper in 0.12**, when the same person gained a second trade (§7.7): two
offers standing beside the same body must not be able to drift about who that body is. Renting the
same berth twice is refused rather than sold again — that is not a second room, it is the same room
and a lighter purse.

`rentBerth(core, gen)` runs every effect through a SHIPPED mutator, in an order that cannot
half-charge anybody:

1. **re-read the offer** — the HUD's copy is a frame old and the player may have walked away or spent
   the money since;
2. `award({ money: -price })` — the purse pays. Deliberately NOT `take()`, which is the ITEM verb;
   money has one mutator and this is it;
3. `setHome(zoneId)` — a sealed anchor, never a minted `h{n}` (which `setHome` refuses on its own);
4. `grant("lodging-key")` — the receipt, and the pouch's first real row;
5. `log()` — the day-ledger line P5 will summarise;
6. `bump()` — the keeper remembers, **settlement-scoped**, so renting twice does not create two people
   with one name.

`award()` is the first verb that can refuse (the generation fence, the loading gate, or a chat switch
under the caller), and nothing after it has run when it does, so the transaction reports
`reason: "refused"` and no field has moved.

**`award()` floors money at zero rather than refusing, and that is exactly why affordability is the
caller's job.** A negative purse is a bug that would then price everything wrong; a floor is the safe
failure. But a floor is not a check — it would silently let a broke player take the room for whatever
they had. So the pair is: `berthOffer` tests `money >= price` **before a single field moves**, and
`award` guarantees the purse can never go negative if some future caller forgets.

### 7.3 The starting purse

`STARTING_PURSE = 40`, granted **once**, when a sealed world comes up on a block **nothing has ever
been written into**. It exists because a sink with no source is not a feature: the real income is the
quest layer, so without it the one transaction 0.11 ships would be unreachable in a shipped game.

**Untouched means the WHOLE block, not the purse.** Four tests would do while the grant was a one-shot
instant; as a condition asked on every arrival it has to tell a new game apart from a VETERAN who
happens to be broke — and a player who has spent down to nothing still carries their skills, the
boards they finished, the people they met, the places they found, and the day boundary they flushed.
The predicate therefore requires: money 0, no items, no ledger lines, `home === null`, empty
`skills.verbs`, `skills.equipped`, `quests_done_board`, `rel`, `quests.done_pack`, no active quests,
no found zones, empty `bought`, `flushedDay === 0`, and `game === 1`. This is also what keeps the
pre-gate transplant shim from being paid: a block with a real session in it crosses that seam holding
exactly these fields.

It is **not** a default on the block (§2.4) and **not** a rehydration step — restore's repairs are
deliberately non-mutations.

### 7.4 Skills, tools, and resolve-at-read

`skills.verbs[verb] = {l, x}` — a level and the experience toward leaving it. `xpPerLevel(l)` is
`10 × l`, so with `CAPS.skillLevel` at 20 the ladder costs Σ 10·l for l = 1…19 = **1,900 xp** end
to end, and nothing in the tuning table can move that. A capped skill stops climbing and has its
`x` zeroed, which is why every surface that renders a level has to special-case the ceiling rather
than draw a bar that is permanently empty and permanently full at once.

`skills.equipped[verb] = {tool: [t, k], mod: [t, k]}` — a pair per slot, by value. **`equip()`
validates by item TYPE and not by slot**: it refuses a graded row whose `k` is off the `QUALITY`
ladder and is otherwise perfectly willing to put bait in a `tool` slot, so **the call sites own the
scoping** (`_autoEquipTool` refuses any type `QUALITY` does not grade; `_slotBait` only ever puts
bait into `mod`). That is stated because it is the kind of invariant a future caller breaks by
accident.

**Everything read off the block for a decision goes through a resolver**, and this is the load-bearing
idea rather than a defensive habit:

| resolver             | answers                                                                    | for a value it does not understand |
| -------------------- | -------------------------------------------------------------------------- | ---------------------------------- |
| `resolvedToolTier(k)` | the `QUALITY` index of a graded tool                                       | 0 — crude, never a bonus, never a throw |
| `resolvedModTier(slot, stack)` | **presence**: 1 iff the slot holds a pair AND the pouch still has a live stack behind that exact pair | 0                                  |
| `resolvedLevel(row)` | a verb's level clamped to `1…CAPS.skillLevel`                              | 1 — a player who has never fished still rolls, at the bottom |
| `resolvedDay(value)` | a day ordinal ≥ 0                                                          | 0 — owes nothing, tells nothing, lifts no gate |

They are **pure** — they take values, not the core — so the hash and the display can resolve the
same row without either reaching for state the other cannot see. **The mod resolver reads presence
rather than grade, and that is a fix rather than a shortcut:** bait `k` are semantic slugs and are
never `QUALITY` members, so an index resolver would map a slotted bait and an empty slot to the
same 0 and make the modifier inert. Graded modifiers are later-release content and arrive as a
second tier here, never as a `QUALITY` read.

**What resolve-at-read buys is determinism across builds.** The fishing roll is seeded from
resolved NUMBERS, so two clients that disagree about what `"legendary"` means still pull the same
fish out of the same water on the same minute; a hostile `k` clamps to crude and the world stays
consistent instead of forking.

Dormant by design in 0.12: `fine` and `masterwork` are priced nowhere, so tool multipliers 3 and 4
are live numbers with no content behind them, and the mod tier has exactly two rungs.

### 7.5 The feature register — what a verb aims at

A verb needs a target, and 0.12's is a **per-zone register** the compiler fills:
`zone.features[] = {id, tag, name, rect}`.

**It is DERIVED and never serialized.** It is not in `snapshot()` and not in `ENVELOPE_KEYS`; it is
recomputed from `(seed, theme, brief)` on every compile, exactly like the zones it describes. So it
costs zero save bytes, it cannot drift, and the guard it needs is the determinism lane in the
harness rather than a migration. (It is deliberately **not** added to the World Maps export either
— see `brief-schema.md` §8 for why.)

**Four recording sites, and the fourth is required rather than creep.** The brief compiler's
placement loop records what it places, with ids that are **brief ordinals** tracked independently of
placement — a feature that could not be placed still consumes its ordinal, so ids do not shuffle
when a settlement is too tight to seat everything. The settlement and the wilds non-crossing loops
are that same code in two places. The third is the **wilds `water-crossing` branch**, which
registers the stream rect under that feature's ordinal because the placer paints only the ford and
never sees the feature — without it, a brief-built stream would be visible dead water while a
legacy stream fished. The fourth is `buildLegacy`, whose two water features carry **fixed reserved
ids** (`legacy:pond`, `legacy:stream`) with tags from the same closed brief vocabulary, because a
legacy world has no brief to mint ordinals from and the catch tables resolve per `(theme, tag)`.

**A rect may hold non-water tiles, and the exclusion lives in the TEST rather than in the rect.**
The proximity check is "a 4-neighbour tile is `water` **and** inside a register rect" — both halves,
neither sufficient alone. Water alone would make any puddle a feature and could not say which one;
a rect alone would count tiles the feature never watered, and rects hold those by design (the ford
lays path straight across its stream, and a compiled pool's companion well stands inside the anchor
rect beside it). Four neighbours and not eight: standing corner-on to a pond is standing near the
bank, not at it.

**The bridge, and why it is here.** Where a road runs through a water rect the road tiles are laid
as **bridge** — walkable, drawn over the water — and the water takes the rest (`waterFill`,
20-world). That is a placement TREATMENT of the water feature and **not a feature of its own**: no
new tag, no new ordinal, nothing added to the brief vocabulary. Two consequences worth stating.
It is what let the water-feature placer stop refusing every wilds anchor that touched the road
band, which is why a brief's wilds pond exists at all now. And standing ON a bridge tile beside
water passes the neighbour test unchanged, so **fishing from a bridge works with no extra code** —
emergent rather than special-cased. A settlement pond that decks a plaza with planks is a blessed
outcome (maintainer, 2026-08-24), not a case to guard against.

### 7.6 Fishing

`fishOffer(core)` describes; `fish(core, target, gen)` spends. `target` is `null` for one cast, or
one of the four daypart words for a session that loops until the clock reaches it.

**A cast is one WINDOW of clock, spent whole.** `castWindow = floor(clockMin / TUNING.castMinutes)`,
and the window's identity — its day and its index — is read BEFORE the clock moves, so a roll
belongs to the slice of time it was spent in. The mover is `sim.advanceMinutes(n)`, which is the
counterpart to `waitUntil`: a rest is over when it reaches a time of day, a cast spends a fixed
window and lands wherever that leaves the clock. **It wraps midnight**, and it has to — "fish until
dawn" is on the menu — so the wrap is a loop rather than a test, and `resolveSchedules()` then runs
unconditionally because a jump of any size can cross a daypart.

**The roll.** Each window seeds its own stream from
`hash(seed, day, castWindow, spotId, level, toolTier, modTier)`, every one of those resolved (§7.4).
`p = base(level) × toolMult[toolTier] × modMult[modTier]`, with everything in `TUNING`. A failed
window is therefore a **fixed point escaped only by spending different time** — which IS the
anti-save-scum property, and is stated rather than discovered.

**0.14 rewrites the THRESHOLD that `p` is compared against, and nothing else about the roll**
(ruling B3-1/B3-2). Two factors compose onto it — the sky over the water and the water itself —
and both are read before the single `rnd()` the roll has always spent, so the seed, the draw count
and the stream position are untouched:

`chances = regionBite × (TUNING.biteRate[word] ?? 1)`, then
`pw = 1 − (1 − min(p, 1))^chances` — a **hazard exponent**, not a straight multiply.

- **The sky.** `TUNING.biteRate` is `{overcast: 2, rain: 2, snow: 2, storm: 2}`. `fair` is absent
  because a clear day IS the baseline and `?? 1` reads it that way. **Intensity never enters it** —
  heavy rain bites like light rain. The word is read at the START of each window, so a session that
  crosses midnight picks up the new day's sky on the next window rather than on the crossing one.
- **The water.** `_regionBite(world, tag)` derives a base from the world's own precipitation axis,
  anchored so that a MODERATE world is exactly ×1 by construction:
  `abundance = max(abundFloor, 1 + abundPerWet × (wetness − moderate.wetness))`. At the shipped
  `abundPerWet: 0.2` and the three wetness values that is **arid ×0.7, moderate ×1.0, wet ×1.3**.
  Spot kind is the second input and both shipped kinds are 1.0 today — still versus running water is
  a content difference now and a rate difference the day a playtest asks for one. It is a pure
  resolved read with zero stream contact, computed **once per session**, before the loop.

**Ten-to-five is the calibration EXAMPLE, not a constant this code carries.** The ruling's sentence
was "a fish every ten in-game minutes on a fair day and every five under a grey one", and that is
the temperate/moderate anchor — the point at which `chances = 2` and the curve is read. Two honest
consequences of the hazard form, both stated rather than left to be discovered: at the low rungs
`pw ≈ p × chances`, so the multiplicative reading holds literally; near the top it compresses
asymptotically toward certainty and never reaches it. The catches-per-window ratio at `chances = 2`
is exactly `2 − p`, so the real number at the curve floor is **≈1.7×**, not a folk 2× that no
reachable `p` delivers. A straight multiply would have made every rainy mid-ladder cast a guaranteed
catch, which is flatly against the ruling's own *"ultimately is still RNG determined"*.

**An arid world fishes SPARSE — fewer bites, never fewer species.** Abundance touches the rate; the
table stays whole. And the fair-day/moderate-water case is the LITERAL shipped expression it always
was (`chances === 1` takes its own branch), so it is bit-identical to 0.13 and doubles as the compat
pin for the whole amendment.

**What the sky does NOT do any more is sort the catch.** Through 0.13 the tables carried four
weather columns; two of them were provably inert — `_draw` normalizes by the sum it just added up,
so a row multiplying every rarity by the same number cancels exactly, and overcast (×1.1 across the
board) and snow (×0.7) left the draw bit-identical to a fair day. The ruling unmade the job rather
than the decoration, so **overcast, snow AND rain are gone from every row**, rain's live ×1.3/×1.4
included. **Storm is the only column left**, because it is the only one that ever moved the draw: it
changes the MIX rather than scaling it — `catch-rare ×1.5` against `×0.6` on everything else, which
measures as a rare share of 4.5% → 10.5%. It is also the release's one authored "fish the storm"
hook.

Storm keeps its rarity lean AND takes the same bite of 2 as the other three, and the two levers stay
orthogonal by construction: the lean is a relative-share fact the draw's normalization preserves at
any bite count, so there is no frequency term in it to double-count. **Where the storm column
CANNOT be reached is worth writing down:** the warmth gate (§7.9) makes a storm arithmetically
impossible at polar latitude in every season and at every precipitation, so a polar world never sees
that column at all; arid four-season worlds meet it about once a year.

**The tables** are per `(theme, spot-kind)` where spot-kind is the register row's `tag` — a 2×2 set,
asserted complete. An entry is `{role?, variant, weight, minLevel, daypart?}`. The **role** is the
shared type and the **variant** is the pouch row's `k`. An entry with **no role IS a bait entry** —
one field, read one way — because bait is a real water yield and fishing is its own supplier. XP
keys on `role ?? "bait"` through the one `TUNING.catchXp` table, so **every** success awards through
the same authority; without that, a session that caught bait first would mint no skill row at all on
a player who has plainly been fishing.

**Bait presence is read BEFORE it is spent.** The window a bait was consumed on rolls baited; the
slot-clear that follows the last one affects the NEXT window, which re-keys the hash at tier 0 and
goes on fishing at the lower rate. **Exhaustion is a continuation, never a stop.** The mod slot is a
per-session SELECTION and not a standing preference: the verb slots the first live bait stack at
session start, spends one per window, clears the slot when the stack empties, and stores no
preference anywhere.

**Refusal values, each distinct, all read before a single minute is spent:** `gate-held`,
`wrong-mode` (walk only, like every clock mover), `not-near-water`, `no-rod`, `pouch-full`, plus two
that are caller errors rather than player-facing states (`unknown-target`, `no-player`) and are
answered by the HUD's generic line rather than copy about a state nobody can be in. **`no-rod` is
reachable on purpose** — see §7.7.

**Two cap interactions, and they are opposite ends of the same cap.** Up front, a pouch already at
`CAPS.items` refuses the session: only merges could land, so it would spend real hours to tell the
player nothing new. Mid-loop, `grant()` refuses only a **NEW** `(t, k)` row — merges never refuse —
so a session can meet the cap on a variant it has not caught before; that window's grant AND its
award are skipped, it logs nothing, and the loop continues. The cap bounds species DIVERSITY, not
quantity, and not the session.

**The receipt is a ledger line, not a turn**, and it is written **one per DAY the session spans**.
The accumulator carries its own day and `_logDay` reads it rather than taking one from the caller —
so a session that crosses midnight files its pre-midnight casts and their fish under the day they
happened, and the next sleep can flush that day. Filing a crossing between an advance and the roll
after it is what once recorded a cast on one day and the fish it landed on the next.

Finally: **every path that moved the clock marks the save dirty**, refusals-after-advance included.
The mutators self-dirty, but a session of failed casts runs no mutator at all and would otherwise
lose its hours on reload.

### 7.7 The rod ladder, and the keeper who is also the outfitter

**No rod is ever free** (maintainer amendment, 2026-08-24). Every rod is purchased, and the berth
keeper is who sells it — the same person, resolved through **one shared helper** (`_keeper`) that
`berthOffer` and `rodOffer` both call, so two offers standing beside the same person cannot drift
about who that person is. Reach is tried first (`npc.lodging`, so an innkeeper standing in the
square at noon can still trade), then the room's own `lodging` mark.

**One button, one ladder.** `rodTier(player)` is the max over pouch rows typed `rod` of
`resolvedToolTier(k)`, or **null** when there is no rod row at all — and null is a different answer
from 0, which is what makes the no-rod refusal an absence rather than a tier. Derived, pouch-only,
nothing written: auto-equip guarantees an equipped rod has a pouch row behind it, and the pouch is
world-free while rods are unremovable in 0.12, so **a severance can never resurrect a rung already
climbed**. The offer quotes the next rung the player lacks: none → `crude`, crude → `decent`,
decent-or-better → **the button vanishes**. That last part is a stated divergence from the berth
button's never-vanish rule — a berth is a thing you can want again tomorrow, rod ownership is
global and permanent, and a forever-dimmed chip saying "you already have one" is dead chrome.
Cannot-afford takes the berth's idiom instead: shown, dimmed, still quoting the price.

**Acquisition is per theme, because fishing means different things in different worlds.** Fantasy
fishing is common, so the entry rod is cheap — half a night's berth. A colony fishes as a niche
hobby, so its keeper quotes the same entry rod at four times the price. **The premium is an
INTERIM**: when the roadmap's device/online-shopping mechanic lands (ROADMAP P11), sci-fi rod
acquisition moves there and comes off the keeper. Nothing asserts the ratio; it lives in a comment
beside the price table, so a retune has to keep that prose honest by hand.

`buyRod` is `rentBerth`'s shape for `rentBerth`'s reason — every effect through a shipped mutator,
in an order that cannot half-charge anybody: re-read the offer (the HUD's copy is a frame old) →
`award({money: -price})`, the only step that can refuse, with nothing after it having run →
`grant` the rod, **plus a starter bait stack on the first purchase** ("line and tackle included"),
at the theme's own first bait slug so it merges with what gets fished up rather than orphaning a
second row → auto-equip, scoped to tools → `log()` → `bump()`. **Nothing is written to `bought`**:
that map is world-bound shop DEPLETION and 0.12 ships no shop stock, exactly as `rentBerth` writes
none.

The offer pre-checks **affordability and pouch headroom with the right arity** — a crude purchase is
TWO new rows unless the player somehow already holds bait, a decent one is one — and that pre-check
is precisely what makes the no-rollback shape sound, because `grant()` must never be allowed to
refuse after `award()` has charged.

**Never forced.** It is a proximity button and nothing else: no modal, no quest gate, and nothing
anywhere in the package depends on rod ownership. Skipping the first settlement's offer costs
nothing, because the ladder is a stateless derived read — any keeper anywhere sells the same next
rung later. And a rodless player at water still sees the Fish button and gets a **themed hint
naming the vendor**, interpolating the keeper's compiled `role` rather than a hardcoded word,
because a colony has no innkeeper and the brief decides what it does have. A world with nobody
letting rooms drops the clause rather than inventing a vendor.

### 7.8 Sleep

`sleepOffer(core)` describes; `sleep(core, target)` spends. "Sleep until \<time of day\>" over the
same four dayparts the Wait menu offers, any hour.

**Bed-gated on the home anchor**, which is the same fact `rentBerth` wrote: the anchor IS the
lodging zone the player holds a berth in, so "in your home zone" and "in a lodging zone you have
paid for" are **one test and not two**. A homeless player has nowhere to sleep (a §11 never-flush
class, accepted), and a minted `{minted: true}` anchor names no zone to stand in, so it is not one
either. Walk-mode only, and refused while the host is streaming — not because of the pipeline, but
because the hours would pass under narration the player has not read yet.

**It sends nothing**, which is the whole shape of it: no turn, no narration, no await. The mover is
`waitUntil` (the rest action's jump), and what it leaves behind is a marker — see §8.

Every refusal is the **nothing-happened** shape that `fish` uses beside it: `reason` carries which
refusal it was and every number carries zero, because nothing moved. The reasons are distinct on
purpose and the numbers must not be, or a caller reading `day` would learn the kind of refusal by
accident and read a live clock off a call that spent no minutes.

### 7.9 The sky: two axes, a calendar, a derivation, and one override

**Weather adds ZERO save fields**, exactly as schedules do. The sky at day D is a pure function of
`(world seed, day, override)`, and the clock is already saved — so a reload, a rebuild and a
timeline rewind all re-derive the same sky. The one thing that is not derived is the GM's override,
and it lives in chat metadata, never in the save envelope.

`17-weather.js` sits at position 17, **before** `18-brief`, and the rule that buys the position is
stated in the module: no module numbered below 17 may read `PF.weather`. The bundle is one IIFE
concatenated in filename order, so a backward read is a `TypeError` at load and a forward one is
free.

#### The two axes, and why two

A world is minted with a **latitude** — `equatorial | tropical | temperate | subpolar | polar` — and
a **precipitation** — `arid | moderate | wet`. One field name per axis everywhere: the brief field,
the schema property, the fold row, the world stamp and `axesFor`'s return are all spelled
`latitude` and `precipitation`.

Two axes rather than one climate word because arid-hot and wet-hot are the same latitude read
through two different numbers, and a single vocabulary cannot say that. Latitude carries `warmth`
(the band's base temperature) and `swing` (its seasonal amplitude) — nearer the equator is hotter
AND flatter, the whole gradient as two numbers — plus a `structure` naming the season set.
Precipitation carries one number, `wetness`, at `0.5 / 2 / 3.5`.

Where the axes come from, per axis and in order: **the brief's hint when it names a real band**,
otherwise a weighted draw from the theme's own distribution. A cozy village is usually mid-latitude
and can roll tropical or subpolar; the colony leans cold and dry. An omitted band is the
distribution speaking rather than a hole — no cozy world is polar — and a boot assert demands a
positive SUM per axis and nothing narrower.

**Each axis rolls on its OWN named side stream.** That is 20-world's own discipline applied to a new
mint: the main RNG stream and every existing side stream are untouched, so **every existing seed
keeps its exact layout and gains a climate**, and a brief that pins one axis never moves the other's
roll. `axesFor` is pure, which is what lets the compile stamp and the generation digest describe the
same sky by construction rather than by whichever world happened to be standing.

The stamp itself is runtime-only, like every other derived field on the compiled world: no save row,
no `briefVersion` bump, re-minted on every load from `(brief, seed, theme)`. A true no-brief legacy
build takes the fixed middles `temperate / moderate`.

The theme table is a theme-keyed table in a third file, which is exactly the drift the brief's
`foldStored` refuses to introduce — so a boot assert turns it into a load-time throw on purpose:
adding a theme to `10-art.js` breaks boot until the distribution table learns it too. A red at the
desk instead of a world with no climate at somebody's.

**One seam is recorded and deliberately not designed.** A colony world may eventually want a climate
two temperate axes cannot say — the module calls it the `Extreme` seam. What shape that takes is a
conversation with the maintainer; what the module owes it is additivity, and it has that by
construction, because every fold reads the exported array and every table is paired against it at
boot.

#### The calendar

**365 days, and every world's year has its own phase.** The offset is `hash(seed | "calendar") %
365` and it runs the FULL year, which subsumes the hemisphere question entirely: "southern" and "day
1 lands in autumn" are the same fact, and one offset says both.

The season set comes from the latitude's `structure`: **two seasons in the tropics**
(`wet season / dry season`), **four poleward** (`spring / summer / autumn / winter`). The year
partitions into `n` equal spans by a floor — four gives 92/91/91/91, two gives 183/182 — and a
season never straddles the year boundary, so there is no boundary table to keep in step with
anything.

Two names are honest about what they are. **A two-season world's "wet season" is
precipitation-RELATIVE**: an arid tropic's wet half is merely its storm-leaning half, not a monsoon.
And **the season-structure mapping is an INTERPRETATION**, flagged to the maintainer rather than
presented as settled (ruling B2-2): two flat seasons at the equator and the tropics, four poleward,
implemented as read and his to amend.

`seasonStartDay()` is the one place a caller may derive a season's first day, and it **floors at day
1**. The full-year offset lands almost every world's day 1 mid-season — 361 of 365 offsets on a
four-season world — so an unfloored answer names days before the world existed, up to 182 of them.
What the floor buys, stated without overclaiming: the returned day is a day somebody could have
lived, and the ledger's first-of-season scan costs a season rather than a year. It does not change
the scan's ANSWER, because the day clamp would re-read day 1 anyway; walked across 1,478 snow
crossings (5 latitudes × 3 precipitations × 6 seeds × 400 days), floored and unfloored differ on
none. **Callers derive their bound from this function and never by hand** — under a 365-day year a
hand-derived season length is wrong by up to 182 days.

#### The derivation — not an enum, and not a table

There is **no per-climate weather table**. One derivation turns `(latitude, precipitation, season
index)` into a weight row over the five words, and the temperature is spent **continuously**, as a
magnitude through two clamped ramps, not as one bit:

```
t     = warmth + swing × TEMP_PHASE[structure][index]
w     = wetness × WET_PHASE[structure][index]          ← the wet MASS, one home, two consumers
cold  = clamp((freezePoint − t) / mixBand, 0, 1)
warm  = clamp((t − stormFloor) / stormBand, 0, 1)
rain  = w × (1 − cold)
row   = { fair:     fairBase + fairDry × max(0, dryPivot − w),
          overcast: overcastBase + overcastWet × w,
          rain,
          storm:    rain × stormShare × warm,
          snow:     w × cold }
```

`cold` is the snow SHARE of the wet mass, so `snow + rain` is identically the wet mass and only the
storm term lets latitude touch how often the streets empty. `warm` is the **storm gate**: convective
violence needs real warmth, which is why a polar year cannot produce a thunderstorm at any
precipitation in any season — polar `t` peaks at 1 against a `stormFloor` of 2. A cold world's
blizzard is heavy snow and never a thunderstorm.

`freezePoint` is where the snow share reaches zero — the top of a MIX band, not a step — and
`mixBand` is how wide that band is: full snow below, full rain above, a real sleet mix between.

Two phase tables, **keyed by ordinal index** into the season set rather than by season word,
deliberately: a word-keyed table would have to agree with two different vocabularies at once, and the
half that disagreed would compute NaN for every cell of one structure rather than throwing anywhere
a reader would look. Four-structure worlds run **flat** wetness — the wet/dry alternation IS the
two-season structure's weather identity. One identity that flatness buys, recorded as a decision
rather than left to be discovered: with the four-season temperature phase symmetric about the
shoulders and wetness flat, **spring and autumn are the same sky, byte for byte**, in every
four-structure band × precipitation pair. Four season names buy three distinct skies per band.
Nothing breaks — the header and the ledger still print two different words, because the calendar is
real and the symmetry is the sky's — and if a playtest ever wants autumn wetter than spring, that is
a one-array retune.

The whole thing is walked at boot: every latitude × precipitation × that latitude's own seasons —
**48 rows**, and the count itself is asserted, because a walk that quietly stopped covering a band
would be a green run over an untested sky. Plus a **degeneracy** clause: no two latitudes sharing a
season structure may produce identical row sets across their whole product. At least one differing
cell is the correct strength and it must not be tightened — subpolar and polar genuinely share their
three winter cells, because the winter-heavy edge and the frozen pole are different YEARS, not
different winters.

`wordsFor(latitude, precipitation)` returns **every sky a climate can produce**: the union of words
carrying non-zero weight across that latitude's own season set. It lives beside the derivation for a
reason the generation digest depends on — a hand table saying "the tropics get no snow" is an
opinion a coefficient retune falsifies silently while every assert stays green. Through the
derivation it is arithmetic, and it moves when the arithmetic does.

#### Five words, and a second smaller axis

`fair | overcast | rain | storm | snow`. **Intensity is a second dimension taken by rain and snow
only** — `light | heavy` — and not two more words: the pack's weather axis, the catch tables, the
schedule bias flag and the snow tile substitution all stay five-valued. Only the header label, the
rain tint and the particle pass ever read the intensity. **The ledger reads neither** — light snow
hardening into heavy snow is the same weather to it.

`takesIntensity` is the one home of "does this word carry a light/heavy", and a boot assert reads
that flag rather than restating the pair in four places: whichever words carry it must carry
per-intensity wire text, and per-intensity TINT alphas wherever such a word tints at all. A missing
heavy alpha would ship "heavy rain looks exactly like light rain", which is a promise this release
makes out loud.

The draw is one weighted pick off the row, then — for a word that takes one — a second draw for the
intensity, whose heavy share derives from the same wet mass (`min(heavyMax, heavyBase × wetMass)`).
Wet worlds rain harder; desert rain is almost always light. **Draw order is deliberate:** the word
draw is always made and simply discarded when an override covers the day, and the intensity draw is
always second. So an override naming the very word the derivation rolled cannot flip the day's
intensity, and the live path and the ledger's first-of-season scan consume the stream identically.

**On screen:** overcast, rain and storm tint (storm hardest, heavy rain at double light rain's alpha); snow
does not tint at all, because the snow TILES carry it. The ground substitution is a **paint-time
rename** read by the renderer's zone composite and by nothing else — `grass → grassSnow`,
`grass2 → grassSnow2`, `crop → cropSnow`, `canopy → canopySnow`. **The zone arrays are never
touched**: a compiled world holds `grass` in January exactly as it does in July, and the
substitution lives in the picture. What is NOT in that table is the design — paths, roads, stone and
`dirt` stay bare, because a trodden way is the first thing to clear, and **water stays water**,
because it is liquid and fishable and a frozen pond is a mechanic nobody has asked for. The
substitution keys on the WORD, not the intensity: a flurry and a blizzard stand on the same white
tiles.

The falling pass runs 45 streaks at fall 1.0 for light and 120 at 1.7 for heavy, with storm riding
the heavy row. It takes its phase from `performance.now()` — **the one declared determinism
exception in the package**, and it is safe because nothing sim-side ever reads it. It is also
load-bearing for the time stop: under an open dialogue window the clock and the darkness ramp hold
still, and the weather is the one surface left moving.

#### The header

The turn prefix carries **three words in the paren group** and each earns its permanent per-turn
cost: the daypart keeps the GM's light and who-is-about narration consistent with what is rendered;
the weather word is the whole channel the sky reaches the narrator through, live, every turn; and
the SEASON is the word that lets the GM make a judgment the daypart cannot — it should not snow in
summer, unless the world it is snowing in is one where that means something. Measured cost in §10.3.

#### The GM override

**Written by nothing in this release except a browser console**, and that is a verified constraint
rather than a scope cut: the host dispatches capability events on engine-defined type strings only,
so there is no surface a real writer could sit on yet. That is the feature request's job. What
ships is the READ side, whole and verifiable.

**Residency: chat metadata, at the key `pixelforgeWeather`.** Not the save envelope — a grep of the
serializer for `weather|latitude|precipitation` finds exactly two lines, both reads into the runtime
sim. There is no registry entry and no serialize/restore row.

**Fold, never throw, and never write back.** The key is per-key shallow-merge PATCH territory, so a
word from a build that has not shipped yet folds to "no override" FOR THIS RUNTIME ONLY and the
stored row survives verbatim for the build that understands it. That is the whole forward-compat
argument and it is the pack key's own. An intensity on a word that takes none is dropped and the row
survives — a GM who wrote `{word: "storm", intensity: "heavy"}` meant a storm.

**It is a day-RANGE predicate**, `[sinceDay ?? 1, untilDay ?? ∞]`, and the range is what makes the
rewind behaviour correct rather than merely convenient. The override is chat-scoped configuration,
like the brief and the content pack: **it does not rewind with the story.** `sinceDay` clamps the
start, so a rewind to before it was ever set restores the derived sky; a rewind INTO the range
re-arms it, which is right, because that is the sky that day already had the first time through. A
cleared range is simply gone. **That is the honest residual, and it is a trade**: the alternative —
a sky that rewinds with the transcript — would need a save field, and weather has none by design.

**The reconciler and its memo.** The load path folds the key into `sim.weatherOverride` and stamps
`sim._weatherMetaApplied` with a SERIALIZED WHOLE of the folded row — never the word alone — ahead
of the boot `resolveSchedules()`, deliberately, because the schedule bias reads the sky and boot
placement has to happen against the overridden one. Mid-session, each props delivery re-folds the
key and compares against **the applied memo, never against `sim.weatherOverride`** — which is what
lets a console write to the runtime slot stand instead of being clawed back by the next delivery.
When they differ, the sim assigns, re-memoises and calls `resolveSchedules()` exactly once: the town
answers a mid-day override with no envelope contact at all. The memo is the serialized whole because
a console change from `{word:"storm"}` to `{word:"storm", intensity:"heavy"}` is this release's
documented verification incantation, and a word-only key would sit on it until the day rolled.

**A vanished row means "no override", never corruption.** The key inherits the #5076
whole-blob-erase hazard — roughly forty engine call sites still use the unqueued whole-blob
metadata writer, which is why `ensurePresent` exists to heal two other keys — and the override key
gets **no self-heal**, because there is nothing to re-derive it from. A future writer must re-write
rather than repair. See §11.

The console incantation, which is two lines and not one:

```js
core.sim.weatherOverride = { word: "storm" };
core.sim.resolveSchedules();
```

Any of the five words; rain and snow take an optional `intensity: "heavy"`. The renderer answers on
the next frame either way — only the schedule bias needs the second line. A console write touches
the RUNTIME slot only, which is exactly right for a throwaway check.

#### The town answers: the hearth-first bias

**Weather biases NPC schedules, and the bias is the settlement half of the feature.** On a day whose
word carries `indoors` — rain, storm and snow — the sim hands the schedule policy one closure,
`indoor(zoneId)`, and that closure is the ONE place "indoors" is defined: **interior-zone
membership**, the compiler's own `mapKind === "building"`, and not roofedness. A wilds is a `place`
and stands in the rain like the street does. On a fair or overcast day the bias is null and the
policy runs exactly as it always has.

**Intensity never reaches it.** Light rain empties the street exactly as heavy rain does — a drizzle
reads as weather, not as an exception. This is stated in three places in the source on purpose, and
structurally guaranteed by the read being `WORD_META[word].indoors`.

What it does, in one sentence: **anybody the policy has standing outdoors on a wet day is sent to
their own fireside instead.** Three rules, in order:

1. **Exempt when the policy names work for this hour** (`post`). The watch keeps the night, a grower
   works the land in the rain, keepers and named workers hold their posts, a stall merchant tends
   the stall. The test reads the policy NAME and never an NPC's identity.
2. **Already indoors → nothing to do.**
3. **Otherwise substitute the row's own DUSK anchor, then its NIGHT one.** Dusk first because a
   resident's daylight indoors is their fireside and not their bed: substituting the night name
   parks the whole town on its own bunks at noon. Both are raw lookups without the usual `?? post`
   tail — post is outdoors, and outdoors is the thing being escaped.

For an ordinary resident that resolves to the **hearth** handle, which the compiler bakes from the
BED's zone with the floor suffix stripped (a household sleeps upstairs while the fire is downstairs)
and boxes one column short of the fire itself — you warm yourself in front of one, not on top of it.

**Capacity-neutral by construction.** Every destination the bias can pick is one the dusk or night
pass already assigns that same NPC, every evening of the world's life — same zone, same box, same
spread. No box receives an occupant it does not already hold: the wet 07:00 pass is the dusk
relocation run early.

**And at night it is a no-op because of where the destinations are**, not because the walk cannot
happen. Measured over 960 compiled worlds across both themes and all four scales: 244 night
resolutions reach the loop, and of 50,832 `home` handles minted, **zero are outdoors** — every one
is a bed box inside a dwelling interior or an inn berth.

**It is a no-op on legacy worlds**, and honestly so: schedule handles are compile-time-only and a
legacy world's NPCs carry none, so the resolver skips them on any sky.

Three exemption classes are worth naming because they are what a player will see standing in the
weather, and each is a decision rather than an oversight. **The destitute** have no bed to go to —
their row is `post` at every daypart and the compiler stands them in the town's public centre, so
they stand in the storm. **A fallback post** is the compiler's anchor for somebody with no job at
all, which means the owner-of-nothing stands in the plaza the bias is emptying. And **there is no
outdoor-job flag in the cast data**, so the test is coarse in both directions: an outdoor-posted
scholar is exempt exactly like the shepherd. Which side of the line a fallback post belongs on is a
felt-behaviour question the maintainer meets in play, not one a table can answer.

Hearth-less residents keep standing in the weather too — a lodger in a named place's quarters, a
wilds resident, anybody sleeping rough. Nowhere to go is answered by standing in the weather and not
by teleporting nowhere.

#### The notable-weather ledger lines

`TUNING.notable` is `["snow", "storm"]`. When a **live** day-crossing brings one in that the day
before did not have, a line is parked for a frame to file:

| sky | line |
| --- | --- |
| storm | `A storm came in.` |
| snow, and the season has seen one | `Snow came in.` |
| snow, and it has not | `First snow.` |

**Called by the three clock movers and by nothing else** — never by `resolveSchedules`, never by the
constructor, never by the restore path. That is what keeps a reload silent: a rebuild re-derives the
same sky it always had, and a world reopened on a snowy day has not just had it start snowing.

Both sides of the compare are derived at the moment of the crossing, so the park needs no state of
its own and is rewind-exact. The compare reads `.word`, because the sky accessor returns a fresh
object every call and a reference compare would file a line on every midnight of a six-day snowy
stretch. **Intensity never reaches the ledger** — the ledger says snow, the header says how hard.
Storms claim no "first": a season's first storm is not a calendar fact the way the first snow is.

**"First" means first of the days the world has LIVED.** The scan walks back to `seasonStartDay()`,
which floors at day 1, so a world whose calendar opens mid-winter still gets a true "First snow." for
its genuine first snowfall instead of losing it to months of phantom pre-world time.

The queue holds four rows of `{text, day}` — the day it HAPPENED, so a multi-day fishing session
files day 12's snow under day 12 and not under the day the drain ran — and a full queue drops the
NEW line rather than losing one a frame has not filed yet. It is runtime-only and never saved. A
frame drains it, because the sim holds no core and no generation and cannot file its own.

**The override's blind spot, stated because it will be met in play:** the park fires only on a live
day CROSSING. A GM (or a console) who sets an override mid-day changes the sky, the header, the
tint, the schedule bias and the bite rate immediately — and files no ledger line at all, because no
day crossed. The same is true of an override that expires. The playtest recipe below therefore
crosses a boundary with a live mover rather than by assigning `sim.day`.

#### Compatibility

| what arrives | what happens |
| ------------ | ------------ |
| a brief sealed before 0.14 | carries no axis fields, keeps none, and **rolls per seed** — the same sky every load, because the mint is pure |
| a content pack sealed before 0.14 | carries no `w` on any line, and a `w`-less line reads as **any weather** |
| a `THEME_AXES` or coefficient retune | **re-skies unpinned worlds** on their next load, and can strand a sealed pack's weather-tagged lines. The rolling-compat class, and it costs pack content and not only the sky |
| a `pixelforgeWeather` row this build cannot read | folds to "no override" for this runtime; the stored row survives verbatim |

The retune row is the reason the brief hint exists, and the reason it is worth pinning an axis in a
world whose climate is part of its identity.

### 7.10 The dialogue window

**The Ask surface IS the interact press** (ruling 3). Pressing `E` beside somebody no longer spends
a GM turn on "I walk up to X and greet them"; it opens a window of named branches answered
package-side, at zero call cost, with the doors to the narrator still in it.

#### Opening, and the two proximity numbers

`nearNpc` is a nearest-within-**26px** centre-to-centre read, and that is the open gate. The window
then survives out to **32px** — `(leaveTiles + 1) × TILE` with `leaveTiles: 1`, tested with `>=`, so
32px from a tile-aligned rest closes it. The geometry is derived rather than tuned: "within one
tile" is the adjacency ring (16px orthogonal, ~22.6 diagonal) plus the half-tile of slack continuous
player coordinates need, and 32 strictly covers the 26px open radius, so **no position a window can
open at is born closed**.

The six-pixel band between them is real and is the reason `E` re-routes: inside it `nearNpc` is
already null while the window is still open, so without the close-first branch `E` would be dead
there — neither opening nor closing. The action rail's label follows the window rather than the
proximity read for the same reason, and dims to opacity 0.45 (never `disabled`) when there is
nobody: an in-band press is live and silently no-ops.

#### The time stop

**The window stops the clock and the player stays mobile.** The clock advances only while walking
WITH NO TALK WINDOW OPEN — a conversation should never burn the afternoon, and a daypart boundary
crossing mid-dialogue would relocate the very NPC you are talking to.

The accumulator is INSIDE the gate and not beside it: one that kept filling would bank the minutes
and dump them the instant the window closed. What freezes: the clock, the day, the daypart
resolution, the day-crossing weather park, and the cutscene stepper. **What does not freeze: the
town.** NPC wander runs outside the gate, and so does the falling rain (its phase is a wall clock,
§7.9). The world stays alive while you read. The one exception is your partner, who stands still —
`nearNpc` is a nearest-within-26px read, which is the wrong question in a crowd, so the person you
are talking to is pinned by id.

The two clock movers that CAN run — the rest verb and the fixed-window advance — clear the latch
first. Time cannot pass under an open window, so a mover either ends the conversation or breaks the
freeze; it ends it, and the window unmounts off the latch on the next frame. That is a **documented**
side effect, not a silent one.

#### The latch and its lifecycle

`sim.talkAnchorId` is the whole state, and it is **runtime-only: never serialized, never restored.**
Four readers: the clock gate, the partner freeze, the window's mounted predicate, and the paid
press's prologue.

It is set at exactly one site (the open) and cleared at: the explicit close, any exit from walk
mode, both clock movers, HUD teardown, a chat switch, a world rebuild, Escape (from the window or
from the Say field), Escape's close-all, a pointerdown outside, each of the three panel toggles, and
a press-time liveness miss. Beyond the latch, the window's own reconciler unmounts when the anchor
is gone, is a different NPC, **is no longer in the zone's NPC list** — one read that answers a
splice, a despawn, a zone change and a world replacement, which is also what makes walking through a
door leave the conversation — when the leave band is crossed, or when the loading gate holds.

One case is a handoff rather than a close: taking a paid door moves the sim to `dialogue` mode,
which unmounts the window on the mounted predicate's mode term **without clearing the latch** —
freeze to freeze, so the clock never restarts for the width of a turn.

#### What the window serves

In order: the person's name and role as a title; up to two **record** branches; up to four **topic**
branches; the escalation pair; one hand-over row per live errand; then the free "Just talk", the
permanent Say field, and Leave.

**The record branches come from the compiled NPC record, not from the pack** — "What do you do?" and
"Where do you live?" — and only the halves the record actually carries. A legacy world has a role
and no schedule, so it answers what somebody does and stays honestly quiet about where they live.
That is the shape that makes a minted resident askable without a single generated word.

**The four topic branches** are `rumor`, `work`, `place` and `smalltalk` — rendered as "Ask about the
local rumors", "Ask about work", "Ask about this place" and "Pass the time". **None of them costs a
GM call**: it is a lookup over an artifact already in memory.

**Always stranger, and it is a ruling** (4). The friend register is written, sealed and stored, and
0.14 serves none of it: friendship is the roadmap's relationship ledger, and a stopgap that guessed
at it would be a promotion the player never earned. On the live measured pack that is **7 of 12
lines** unserved, which is the honest cost of the ruling and the reason the selection ladder relaxes
as hard as it does. The generation guidance is inverted to match — 0.13 asked for more friend lines;
0.14 asks for mostly stranger ones and says the friend register is written for a later release.

**Honest suppression: a branch with no servable line does not render.** Four dead buttons that
answer with somebody else's topic would be worse than two live ones.

**And that produces an inversion this release ships with, knowingly.** The default packs carry a
0.14 coverage floor — two any-weather stranger lines per (handle × topic), boot-asserted — so all
four branches render on a legacy world or a declined generation. A world that SUCCEEDED at
generation reads none of the defaults (`sealed ?? defaults`, never a merge), so a thin sealed pack
shows one or two branches. **The worlds that paid two GM calls meet the thinnest window.** The fix
is a wider generation, not a merge; the widening shipped in 0.14 and the floor came down to 10 to
match, but the inversion is real until a live run says otherwise.

#### The selection ladder

Every branch walks an ordered ladder of RUNGS, each a filter, and takes the first rung that has
something unserved.

**Topic branches relax the place and never the topic.** Four rungs: `at + when + topic`,
`at + topic`, `when + topic`, `topic` anywhere. A rumor branch that answered with a work line would
be a button that lied about what it asks. **Smalltalk gets six**, because it is the branch that may
also serve untagged lines: `at+when+smalltalk`, `at+smalltalk`, `at+when+untagged`, `at+untagged`,
`smalltalk` anywhere, `untagged` anywhere.

**The served set is per (day, BRANCH) and never per rung.** The ladder walks rungs in order, so a
when-pinned rung going empty across a daypart boundary drops service onto a when-relaxed rung whose
pool CONTAINS the line just served — and a per-rung cursor would serve it straight back. Line
identity is the index into the folded pack's line array. The set clears at midnight.

**An exhausted rung falls through to the next one** rather than starting over inside itself. The
default pack's floor counts two lines per (at, topic) while the first rung pins (at, when, topic), so
that rung holds exactly one line wherever it holds any — a wrap that restarted inside it would answer
every press after the first with the same sentence, forever, in **48 of the 96** (theme, at, daypart,
branch) cells whose reachable pool has two or more lines, measured on the shipped defaults.

**Exhaustion wraps once.** If every rung is walked with nothing unserved anywhere, the set clears and
a second pass serves from the top rung again. After exhaustion, repeats are the honest state: a
branch that went silent would be a button that stopped working halfway through an evening.

**The pick, inside a rung, is three keys in order:** nearest the hour first, then a weather-tagged
line ahead of an untagged one at equal distance, then a seeded shuffle. **The adjacency metric** is
circular over the daypart start minutes — `min(raw, 1440 − raw)` — so "dusk" is near "night" the way
a clock is, and an unknown word sorts to the far end at 1440. The shuffle is keyed by the rung's own
membership signature (seed, branch, which axes the rung pins, the day, the sky, and the pinned axis
values), so two players on the same seed and day hear the same order and a different day re-deals.

**The weather term matches on the WORD only.** A line with no `w` is served under every sky; a line
tagged `rain` is served under any rain. An intensity never enters it. The generation asks for four
words (`fair` is omitted — a line tagged fair spends four characters buying the generalization it
had for free) and the seal accepts all five.

#### Exclusion, and the paid set

The window and the three panels — journal, character sheet, board — are **mutually exclusive in both
directions, per toggle.** The window's opener closes all three; each of the three toggles closes the
window, and each of those is a latch clear, so the clock starts again. Escape's close-all counts the
window as one of the set in both halves. The reason it had to be wired both ways rather than once:
an unexcluded journal mounts full-bleed above the window, which is a player reading a journal over a
frozen clock with an invisible window underneath.

**The paid set is four presses deep** — free talk, say something, press them about it, and one per
errand hand-over — so one conversation can bump the same person up to four times, once per ACCEPTED
turn. That is still what the encounter count says it is; four accepted turns are four encounters.
The escalation's paid half is a ratchet: it retires once burned.

**The doors never vanish; they dim, with the title saying why.** A host that is not taking turns, or
is mid-stream, gets a dimmed door and a sentence, not a missing one.

**The Say field imposes no length cap, and that is the one deliberate exception** in a package that
caps every other part of a composed turn at a named number (situation 240, place flavor 120, persona
100, names 24). The difference is what the text IS: every door those caps govern is STORED DATA
re-entering composition, and this is live player input, typed this second by the person whose turn it
is. **The honest residual:** if the host refuses the turn, the player gets the generic refusal toast
and the typed text is not preserved — and the downstream bound is not something this package can
see. See §11 and §12.

#### The default-pack enrichment

The default packs grew to carry the coverage floor: **24 lines per theme**, taking each from 32 rows
to 56, at +3,230 serialized chars for the village and +3,286 for the colony, against a line cap of
320. Interior handles get no floor — the enrichment is for the three handles a stranger is actually
met on. The floor is boot-asserted per (theme × handle × topic), so a default pack that lost its
coverage fails at the desk rather than rendering two branches at somebody's.

---

## 8. The wrap-up: staging, the flush, the band, the panels

0.11 shipped a ledger buffer nothing filled and nobody read. 0.12 fills it, tells it, and shows it,
and the machinery is a **two-field flush** — one durable field and one ephemeral one — plus a
serialized notice band and two panels.

### 8.1 The durable half: `intro.ledgerOwed`

**It is not in the player block, and that is deliberate.** `sim.intro.ledgerOwed` is one integer
under the envelope's existing `intro` key: the last day a completed sleep made *owed* to the
wrap-up. A wrap-up marker is not worth an `ENVELOPE_KEYS` entry of its own, and `intro` is already
in the envelope and already about "what the GM has and has not been told".

**The load path had to be edited to carry it, and without that line the design is void.** The
`simFromSaved` intro parse is a CLOSED literal — any subkey not named there is stripped on every
restore and every rebuild — so the field gains an explicit
`ledgerOwed: PF.player.resolvedDay(saved.intro.ledgerOwed)` beside `world`/`zones`/`npcs`. A marker
that does not survive a reload can never outlive the session that staged it. Read through the
resolver because it comes off save JSON and is about to be compared against `sim.day`. **Adding any
field under `intro` means adding it there, in the same change, or it is write-only state.**

**Staging: on ANY completed sleep, `ledgerOwed = max(ledgerOwed, sim.day − 1)`, read AFTER the
advance** (`stageLedgerOwed`, 30-sim; the maintainer's ruled variant). No crossing detection, no
captured day-before. So a sleep of any length at any hour owes every elapsed day — which is what
makes the post-midnight fisher who beds at 00:30 flush last night's catch *literally*: the session
filed its pre-midnight half under the day it happened (§7.6), this owes that day, and the hours
since midnight belong to the day still underway. `max` because sleeps accumulate and the marker only
climbs: a rewind can take the clock backwards and a marker that followed it down would quietly
un-owe days the player was already promised. Waking hours stage nothing — nobody sits down to look
back over them — so **Wait never stages**, which is one of the two never-flush classes in §11.

`ledgerOwed` is **world-unbound** and a severance does not touch it: the days it owes are days the
player lived, whatever world they lived them in. That is also what makes the restore-re-tell row in
§11 work.

### 8.2 The invariant, and the guard that enforces it on itself

**`flushedDay ≤ ledgerOwed < sim.day`.**

`PF.player.flush(core, throughDay, notices, gen)` is the one writer that could break it, so it
**refuses unless all three hold**, each read from the LIVE sim at write time rather than from
whatever the sender was looking at when it composed:

1. `throughDay ≥ flushedDay` — a tell composed against an older gate, resolving after a newer one
   already rose, has nothing to do, and lowering the gate would re-tell;
2. `throughDay ≤ intro.ledgerOwed` — beyond it are days the player has not finished living, or a
   rewound sim that never staged them;
3. `throughDay < sim.day` — never the day underway, whatever the marker says.

**This closes a seam the generation fence cannot see.** `PF.save._gen` moves only on a chat switch,
while `_rebuild` replaces `core.sim` wholesale WITHOUT touching it — a rewind, a swipe, a checkpoint
load. So a send resolving over a rewound sim passes the fence and would otherwise write a future
gate onto the rewound block. The guard reads live, so it refuses instead.

**The senders swallow the refusal**: no toast, no retry. A guard refusal after an accepted send
leaves the tell in history un-burned and the next compose re-tells it, which is a §11 lost-flush
cause and not something to interrupt the player about. The boolean return is for the tests.

### 8.3 The ephemeral half, sender capture, and the band's told flag

`composePrefix` sets `pending.ledger = {throughDay, notices}` alongside the one-shot flags and
**stays pure** — nothing burns at compose time, so a refused or failed send loses nothing.

**The sender's capture is closure-local, and both ways of getting it wrong are real bugs that were
had.** Immediately after composing, the sender takes `const pend = sim._pendingIntro`; on the
accepted branch it runs `PF.player.flush(core, pend.ledger.throughDay, pend.ledger.notices, gen)`.
Never a post-commit re-read — `commitIntro` nulls the field wholesale, so a re-read finds null
forever. Never a fresh read of the stash — that is the wrong compose after an interleaving. Travel
additionally captures `PF.save._gen` **pre-await**, because its existing captures are spatial's own
generation and chat id, which are a different fence from the one the player mutators answer to.

**Why the notice ROWS are a parameter and not a live re-read.** The guard reads three numbers, and
**three of the five notice writers move none of them** — the dangling-quest repair, a mint
severance, and a restore landing on a gate already where it was all append to the band while leaving
`flushedDay`, `ledgerOwed` and `day` untouched. All three run inside `_rehydratePlayer` ←
`simFromSaved` ← `_rebuild`, which is unfenced on the same chat. So a rebuild landing mid-send hands
the burn a live band with a row **nobody composed** in it, and a re-read would mark it told. The
band answers to that flag and to nothing else, so a told row nobody was told is a sentence destroyed
in silence: no gate to re-open, no day to re-select. Marking the CAPTURED rows is safe in the same
interleaving for the opposite reason — under a rebuild they are orphans of a replaced sim, and
writing a flag onto an object nothing reads any more is a no-op. The fresh notice stays untold and
rides the next compose, which is the only turn that can honestly carry it.

**The band's contract, in one line: lines answer to the day gate, notices answer to their told
flag.** A notice explains something that happened TO the save rather than something the player did
in a day, so it has no day group to belong to and nothing has to lift it above a gate to keep it
tellable (§3.5).

### 8.4 What the tell renders, and what a re-tell is

`_composeLedger` (30-sim) selects lines by `flushedDay < day ≤ intro.ledgerOwed`, **stubs
included** — an elided day that says "12 things happened" is still the truest account of it there
is — and every **untold** notice whatever day it carries. Returns null when there is nothing owed
and nothing untold, so an ordinary turn costs nothing.

**Whole days, oldest first, and the NEWEST dropped.** The budget is `TUNING.ledgerTellChars`,
measured in graphemes over the line TEXTS and deliberately not over the framing, because the budget
is floor-asserted against one maximum-shape day (`ledgerPerDay × ledgerChars` = 3,000) and a measure
that counted the word "Day" would put a legal day over the floor and stall the flush forever. Days
render oldest-first so the story arrives in order, and **the burn advances only through the last day
rendered WHOLE**, so a truncated tell leaves `ledgerOwed` standing and the next turn continues from
where this one stopped. The oldest day always rides, over budget or not: a day this build can WRITE
cannot exceed the budget, but a hostile save can carry fifty lines on one day, and "tell nothing,
advance nothing, forever" is a worse answer than one oversized part.

**A re-tell is not a stored replay.** Nothing persists what the first tell said; a recompose reads
the same LIVE-field selection again. With no intervening staging it renders the same days — byte
identical is claimed for the no-compaction, no-staging case only, since compaction may since have
stubbed a told day and the re-tell then renders the stub (bounded, content-preserving). An
intervening staging WIDENS the window, which is a fresh tell carrying the lost one rather than a
divergence.

**Position in the prompt:** last in the compose join — after the persona part, before the sender's
own action text. It is also **the only part of any turn a fishing word — or a quest word — can reach
the GM through** (maintainer amendment, extended when the quest layer landed): neither verb family
narrates anything, both file ledger lines, and those lines are told here or not at all. Note the
honest scope of that claim: it is about **package-authored** vocabulary. A brief a player wrote
fishing or a job board into is theirs, and out of package control.

**The quest family widens the GM-invisible verb gap**, and the honest statement of it is that the GM
can neither *mint* a quest nor *pay one out*. The board is a package fixture reading a sealed content
pack; the completion pays from a table this package owns; nothing in a turn asks the narrator's
permission for either. What the narrator gets is exactly what the fishing verb gives it — past-tense,
day-grain history at the wrap-up boundary — and that is deliberately the whole channel, not a first
instalment. The one exception proves the rule: a `deliver` errand finishes on a turn the player was
sending anyway, and even then what the GM sees is a greeting rather than a handover. The roadmap's
P7 entry is where the widening gap is tracked.

**The line grammar** (what a quest may put in front of the narrator): a fixed per-theme scaffold with
slots drawn from **sealed facts only** — the giver's name, the place or zone name, a count, the
template's title from the pack, the reward — always **past tense**, because the tell is day-grain
history rather than a report on now ("walked out to The Wood for Ivy", never "Ivy is waiting in The
Wood"). Names are **known-cast-guarded** at the moment the line is written and the clause is dropped
on a miss, so a line can never name somebody this world cannot stand up. The covenant is the short
version: sealed mechanical facts in, invented dialogue and motive out.

**Concurrent senders can tell the same wrap-up twice** in one history — Travel composes and awaits,
Talk slips into the window and composes the same tell, both accepted. Harmless: both selected over
stable live fields, both produce equal `throughDay`s, both pass the guard's `≤`, and the second burn
is a no-op.

### 8.5 The two panels

Both open from **topbar chips** beside the location, clock and purse — not from the action column,
which stays the thumb zone. The chips need their own `!inWorld` toggle even though the loading gate
hides the whole topbar for free, because the topbar deliberately STAYS UP in dialogue mode. Neither
panel has a teardown of its own: both are children of the HUD root and go when `destroy()` removes
it, which is the gate panel's precedent — a panel with its own teardown is a second thing to
forget. And **neither is marked an `aria-modal` dialog**, deliberately: the key handler treats any
visible `[role="dialog"][aria-modal="true"]` as the host owning the keyboard, so a panel that
marked itself one would make the very keys that close it inert the moment it opened.

**The journal** is one list, day-grouped from each line's own day, newest day first, with the
**notice band outside the grouping entirely** because it reads a different array. Its memo is the
two arrays and their two lengths: the identities catch a wholesale replacement (compaction rebuilds
`lines` on every append; a restore assigns a fresh band) and the lengths catch an append that kept
its array, which is exactly what `notice()` does while the band is under its cap. It deliberately
does not track the told flag — the band shows told and untold rows alike, so a burn changes nothing
it draws.

**The character sheet** is the compact primary view of the player, and it has two properties worth
naming.

_It renders from a **descriptor**, not from DOM._ `[{section, rows: [{label, value, kind, detail?,
source?}]}]`. 0.12's sections are Skills (each verb's themed name, level, and xp-to-next — a capped
skill reads "MAX"), Equipment (each equipped pair through `describe`), the purse under a heading
named for what this world calls its money, and Standing as an **aggregate** — how many people sit on
each rung of the disposition ladder across every zone, with hostiles counted separately because a
flag is not a rung. `detail` and `source` ship in the shape and **empty**: they are the seam the
extended journal surface fills when perks and boons land, and a shape grown later is a shape every
consumer has to be re-taught. Swapping the function that builds the descriptor is what a ruleset
would be (ROADMAP P8).

_It is a **live value key**, not a snapshot._ The player block carries no identity signal — every
mutator mutates IN PLACE — so a built-at-open sheet would go stale the moment a Talk bumped somebody
or a cast paid xp. Instead, per frame while open, the sheet computes a cheap key over money, carried
count, each verb's level and xp, the equipped pairs BY VALUE (covering the fresh-pair equip and the
`delete` unequip alike), the standing tiers, the hostile count, **the world's theme**, and
`PF.assets.status` — and re-renders only when the key changes. **THE INVARIANT: the key is the
projection of precisely what the sheet renders.** Widening the sheet widens the key in the same
change, or the new half never re-renders. The theme is in the key for exactly that reason: four of
the rows come out of the world's word book, and a `_rebuild` that lands a different theme moves all
four while every player field sits still — and the asset loader that would otherwise carry that
re-render is parked whenever the host names no package or the last load failed inside its backoff.

The portrait is the player's own walk sprite drawn onto a frame-sized offscreen canvas and
integer-scaled with `image-rendering: pixelated`, at the world draw's own fallback hue so the
Tier-0 portrait is the same person the map shows. The pre-ready Tier-0 window is accepted:
`assets.status` sits in the key, so the portrait upgrades the frame the authored art arrives.
Beneath it is a **themed generic label** — "Traveler", "Drifter" — because the package has no player
name and the host props expose none; engine persona name + avatar exposure is an enumerated Engine
FR (ROADMAP P8).

Both panels are read-only and call no mutator, so neither needs a refusal vocabulary. **They part
company on what a mode change does to them, and the asymmetry is the design.** The sheet **CLOSES**
— state cleared, not hidden — on any transition out of walk mode, because `e`, a cutscene beat and
the props-driven replay/combat modes can all fire under an open one, and a sheet that merely hid
would resurface drawn against whoever the player was before it. The journal only **hides**: it is a
list of what is written down, it has no live descriptor to go stale, and losing a scroll position
to a passing combat state would be its own small rudeness.

Both are also reachable from the keyboard — `c` toggles the sheet and Escape closes whichever panel
is open — and both key branches sit **below** the keydown handler's walk-mode bail, which is what
makes every guard above that line theirs for free: the loading gate, focus inside a host control, a
visible host modal, and walk mode. A branch placed up beside the dialogue-Escape handler would skip
all four.

---

## 9. The quest layer

0.11 shipped `quest()` and the two completion maps and nothing that called them: a mutator with no
producer and no renderer. 0.13 gives them both, and the shape it gives them is worth stating before
the parts: **the block did not change**. `quests.active`, `quests.done_pack` and
`quests_done_board` were already there, already classed (§1.1), already capped (§1.2), and the whole
release writes into them through the mutator that was already the only writer. What is new is a
world fixture, a second sealed artifact, three verb sites and two surfaces — all of it above the
wire, none of it in it.

### 9.1 The board, and the fourth proximity read

**The board is a compiler FIXTURE, not brief content.** Every settlement gets one, unconditionally,
under the reserved id `board:settlement` (`20-world.js` `BOARD_FEATURE_ID`) — on a world with no
content pack behind it exactly as on a world full of work, because the board is the surface that
says "No work posted here" out loud and a missing fixture cannot say anything. Its tag
(`notice-board`) is deliberately **not** one of `18-brief`'s `FEATURE_TAGS`: no brief may author a
board, and the consumer resolves it by the reserved id rather than by tag, so a brief that names a
feature after it still cannot be one. Its name is word-book data on `ZONE_NAMES`' own pattern — _The
Notice Board_ in the village, _The Job Terminal_ in the colony — because the fixture has no brief to
name it.

**It is pushed onto `zone.features` OUTSIDE the `_ids` ordinal walk**, on the `legacy:pond`
precedent. The ordinals belong to the features the BRIEF wrote, and spending one here would
renumber promises a sealed brief has already made (§7.5's independent-ordinal rule, read from the
other side).

**The anchor ladder** runs in order, and every rung is ground people already stand on: the apron row
beside the gathering place's door → a dense rank's green, then the gaps between market stalls → the
spine road flanking spawn. A sealed brief can name no gathering place at all, which is why there are
three rungs and not one. If every rung is occupied the compiler **scans** rather than shrugging: an
unanchorable brief FEATURE is dropped ("a plainer settlement, never a sealed one"), but the board
cannot be dropped, because a settlement with no board is a settlement that cannot say it has no
work. `buildLegacy` carries a hand-laid twin — the ladder's first rung written out as a literal, one
step west of the inn door — since that layout has no brief and no ladder to run.

**Worlds are derived per load, so every existing save gets its board on the next boot**, with
nothing migrated and nothing written. That is the same property that makes the feature register
free (§7.5): the fixture costs zero save bytes because it is recomputed, not stored.

**`nearBoard` is a fourth proximity read** beside `nearNpc`/`nearPortal`/`nearFeature` (`30-sim.js`
`step`): four-neighbour adjacency against the board's register rect, found by the reserved id,
null-on-step-away, walk-only. It carries **no water term**, and the absence is reasoned rather than
saved: §7.5's two-sided test exists because a water rect holds non-water tiles, and it is the water
that says which pond a bank belongs to. A board rect is a **single tile and IS the fixture**, so the
rect alone is exact. (The compiler refuses a board rect containing water, and the harness asserts
it, so the two halves cannot drift apart.)

### 9.2 The content pack: the second sealed artifact

The brief is world IDENTITY; the pack is world CONTENT. They are stored the same way and they mean
different things, and almost every rule below falls out of that one sentence.

**Two chat-metadata keys, both top-level** (`60-save.js`): `pixelforgePack` holds the sealed pack,
and `pixelforgePackWanted` holds the SEAL-SIDE marker. Per-key shallow-merge PATCH like every other
key, so an older client carries the pack across a round trip untouched — it never reads or writes
that key at all. Unlike the brief, the pack has **no legacy nested home**: `_configBrief` still
reads one because chats were sealed before the key moved, and the pack has never lived anywhere
else.

**Why the marker is copied rather than read where the wizard wrote it.** The wizard's answer lives
in `experienceConfig`, and that object is REWRITABLE — `/game/create`'s reuse-an-existing-chat arm
replaces `gameSetupConfig` wholesale while the spread preserves top-level keys. A formula reading
the wizard's own copy could therefore be flipped ON for a veteran chat sealed long ago
(retro-generation nobody asked for, at a paid call per chat) or OFF for a chat mid-creation with a
pack call still owed (silently packless forever). So the seal PATCH takes a COPY of the answer and
stores it beside the brief it sealed, and `packExpected()` reads only that copy, which no
`setupConfig` rewrite can mint and none can erase.

**A chat sealed before 0.13 carries no copy and is therefore never expected to have a pack.** That
is the packless-veteran ruling, and §11 records it as a limitation rather than a bug.

**Fold-at-read, and the one invalidation rule that is not free.** `packFold(core)` derives what THIS
world can offer, once, into a slot on the sim — never saved, rebuilt exactly when `core.sim` is,
like the feature register and the schedule handles. The rule 0.13 had to add is the GATE'S LIFT: two
of the three ways out of the loading gate seal a pack under a world that is deliberately NOT
replaced, and a memo taken while the gate held answers for the pack that was ABSENT then. So the
fold is rebuilt when the sim is replaced **or when the gate lifts**, and `_liftGate` clears the slot
because it is the one line every path out of the gate passes through.

**Demotion.** The pack carries the `briefHash` it sealed against; a mismatch means the world under
it changed, and the SELECTABLE SET falls back to the default pack. **It touches nothing else** — live
rows stay, render through the shared fallback, complete and abandon normally, and sever and repair
exactly as before. A demotion is a content fact, not a save event. One guard is worth naming: hash
**zero is not a brief** (it is what `briefHashOf` answers for a world that has none, and it is the
default pack's own sentinel), so a brief-less world treats every stored artifact as never-sealed
rather than adopting a foreign pack as its own.

**The default pack** is a read-time fallback and nothing else: two themes' worth of hand-authored
dialogue, escalation, overheard lines and generic templates, folded and validated through the same
door a sealed pack is, boot-asserted like the skins — and **never sealed**, never written to
metadata, and never the answer to a failed generation (the gate holds and the retry is free).

**The daily selection** hashes `(seed, day, "b1")` over the SORTED SET of surviving template ids and
never over post-fold ordinals, so two builds that fold the same templates out of the same pack post
the same board on day 12 whatever order the stored array happens to list them in. It is memoised by
day. What it deliberately does **not** buy is stability across a CHANGE of that set: the selection
is a shuffle of the whole pool, so a template folding out reshuffles every day's offers, not only
the ones it was on. Benign, and of a piece with a demotion — neither touches a live row.

**Counter classes, and the split the tab renders.** `p:<packHash>:<slug>` is WORLD-BOUND (generated
content belongs to the world it was written for, and is severed with it) and counts into
`quests.done_pack`; `b:<slug>` is WORLD-FREE — the default pack's generic work means the same thing
anywhere, true by construction because the four rows that target a CATCH name a role rather than a
variant (a role means the same thing in every theme), and the other four name stock-cast residents
and generic place handles every world stands up — and counts into `quests_done_board`.
`quest("complete")` routes on exactly that prefix, which is why the id class is the whole of the
rule.

**The seal/fail substance floor.** `validate()` returns **null** below the floor, and null is a
FAILURE rather than a thin success: the gate holds, the retry screen says the world is safe, and
nothing is stored. A pack is the one artifact whose absence is survivable, so sealing a hollow one
would trade a free retry for a permanent nothing. The floor is a pair of `TUNING` rows — three
templates and twelve dialogue lines — chosen from the truncation arithmetic written out beside them,
and the ladder gained one failure kind the brief's does not have, `"thin"`, so a 200 that seals to
null is reported as what it is rather than folded into `"refused"`.

### 9.3 The lifecycle: accept, progress, complete, abandon

**Instance ids carry the template.** `b1.d<day>.<templateId>` is deterministic per (board, day,
template), so a rewind that replays the same day mints the same id, and a same-day duplicate accept
refuses **by id inside the mutator** rather than by a check anybody had to remember to write. The
template rides IN the id because the completion counter is keyed by template and the row does not
carry one.

Two consequences of that shape, both load-bearing:

- **`_dedupeActive` dedupes board rows at TEMPLATE grain**, which is wider than the id. Two instances
  of one template taken on different days never collide by id, so the "at most one live instance per
  template" invariant the offer layer enforces would have no owner below it — and the restore paths
  are exactly where that bites: a mint severance parks a row, the player takes the same work again
  tomorrow, and the mint restore CONCATs the parked copy back onto the live list. The preference
  order does not move (live first, then furthest along); only what counts as "the same quest" widens.
- The dedupe reads the id convention **through `PF.pack`** rather than re-deriving it, so the dedupe
  and the counter cannot come to disagree about which template a row belongs to. With no pack layer
  present the key falls back to the id, which is what this function did before the board existed.

**Accept.** Every effect goes through a shipped mutator in an order that cannot leave a half-taken
job: re-read the board (the menu's copy is a press old — the player may have walked away, filled
their list, or taken this very row on the button beside it) → `quest("accept")` → `log()` at the
event's day. No bump: taking work is not yet a favour done. **`r` is copied into the row here**, off
`TUNING`'s derivation from `(verb, n)`, which is what makes a retune move future accepts only: an
accepted deal is honoured.

**The offer states are answered once and re-answered on every press**, so a two-press race cannot
accept twice, and their precedence is the honest one — `taken` before `filled` before `dup` before
`at-cap`. A row you took an hour ago should say so rather than blaming a full list; a row you
FINISHED an hour ago should say that rather than that you are on it; and a full list is only the
reason you cannot take work you have not already got.

**The day's receipt is TEMPLATE-keyed and lives on the sim, not on the wire.** `filledToday` is a set
of template ids rebuilt on the first read of a new day (the sim has no hook to hang a midnight
callback off, and a set rebuilt when it is asked for cannot be stale when it is read). **Two honest
consequences.** A reload forgets the day's receipts, so a player who reloads mid-day can fill the
same template twice — accepted under the rolling-compat posture, since the alternative is a new
persisted field on the save wire for a rule about one day, and it self-heals at midnight. And a
rewind clears it too, which is the *right* answer there: a rewind that un-completes the quest should
un-file its receipt with it, and `_rebuild` replacing the sim wholesale does exactly that.

**Progress is EVENT-DRIVEN at the verb sites** — never a pouch read, never a `grant()` hook, never a
sweep. The catch site is inside `fish()`'s **granted region**, beside `tally.caught.push`, so a
cap-REFUSED catch takes the `continue` above with its award and does not count. It is a **filter and
never a find**: two live orders for the same fish are both advanced by the one that landed. The
predicate is the shared matcher the seal validator and the default-pack lane also call — role grain
matches any yield of that role, variant grain the exact `(t, k)` pair — because three readings of
that is how a role order comes to count a variant catch in one place and not another. **Zero ledger
lines per progress**, deliberately: an increment is not an event a wrap-up should read out, and a
session of fishing would otherwise file forty of them and evict the day it happened on.

**There is exactly ONE completion path**, `settle()`, and three callers reach it, because three
copies of a completion is how one comes to pay at one site and not bump at another. Its order:

1. **Capture** the reward, the giver and the template BEFORE the splice — `row` is an object
   reference so its fields survive, but a re-find by id after the splice finds nothing, and nothing
   below has to go looking;
2. `quest("complete")` — the splice, the counter and the pay. **No verb reaches `award()`** (§9.3's
   reward rule, below);
3. the day's receipt, so the same work cannot be filled twice today;
4. `log()` at the sim's day — event-side, at the EVENT's day, which is what makes a job taken on day
   3 and finished on day 9 read as two lines under two days, neither of which moves because the
   other happened. The giver's name rides only while this world still stands them up (the fold's
   `known` set), because a line naming somebody the world cannot resolve is a line the wrap-up would
   read out as fact;
5. `bump({t: 1})` — an encounter, on the same settlement-scoped key every other bump uses, skipped
   silently on the same miss.

**The three sites that call it:**

| verb      | where it finishes                                                      | why there                                                                                                       |
| --------- | ---------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `catch`   | the board's **hand-it-in** press                                       | counting is what it does, so there is a fraction to carry and a place to bring it                               |
| `visit`   | **on entry**, from the two real zone-change callers                    | the walk WAS the quest; it matches on the zone's `place` HANDLE, which the compiler stamps and nobody guesses   |
| `deliver` | **Talk's accepted `.then`**, after the host has taken the turn         | no item moves — it is an ERRAND, and word is delivered by talking                                               |

Three details that are decisions rather than incidents. `visit` has **no mode test**, alone in this
layer: a drift arrival lands while the player is reading narration — that IS the mode a narrated
arrival happens in — and refusing it would leave a row nothing can ever complete. Accepting while
already standing in Y does not instant-complete, and re-entry is idempotent, both because this runs
on a zone CHANGE and the first arrival splices the row. And `deliver` is fenced **twice**, by the
captured generation and by the sim's identity (`_rebuild` replaces `core.sim` without moving `_gen`,
so the generation fence alone cannot see a rewind): on a mismatch the caller simply does not call,
the quest stays active, and the honest cost is one extra GM call in a race nobody will notice.
`deliver` is also **the one non-GM-free quest verb** — the handover costs exactly one GM call, which
is the greeting the player was sending anyway.

**Turn-in** is its own function because two things happen there that `settle` cannot do for itself:
the live row is **re-found by id** (the menu drew it a press ago, and the row is what pays), and the
press **refuses unless `have >= n` at THIS read**. The mutator pays with no such check by design — it
trusts its caller — so that line IS the check, which is why the harness pins the press side rather
than the mutator.

**The reward rule, ruled by the maintainer and enforced twice.** Rewards in 0.13 are **money and the
giver's rapport, and nothing else**. Quests **never** grant skill experience: a quest's TASK may
raise a skill — catching fish for a catch order levels fishing, because the CATCHING does, through
`fish()`'s own award — but the reward never does. Two halves hold that up and they fail differently.
The **guarantee** is structural: the reward derivation writes `xp = 0` by construction, so an honest
row has nothing to pay. The **backstop** is the completion passing NO verb to `award()` — no fallback
to the row's own — which answers a row that never came from the derivation at all (a hand-edited
chat metadata blob, a forward build, a save carried in from somewhere else): `accept` stores `r` as
given, so a planted `r.xp` reaches the completion intact, and `award()` applies the money and drops
the experience precisely because there is **no verb to key a ladder off**. The wire field stays —
the row is a closed eight-field literal and dropping `xp` would be a format change for nothing.

**What a severance does to a job, and it is §3's machinery unchanged.** `quests.active` and
`quests.done_pack` are world-BOUND (§1.1) and `quests_done_board` is world-FREE, so a **brief**
severance parks every live row and the pack tally in the `stamp` entry and leaves the travelling
tally alone; a **mint** severance parks only the rows whose giver the mint took away, and its
restore CONCATs them back onto the live list — which is exactly the case template-grain dedupe was
widened for. Two smaller things fall out of the same machinery and are worth naming because a reader
looking for special quest handling will not find any: the **repair pass** drops a row whose giver
this world cannot stand up at all (gated, and it refuses to act when *every* giver dangles, because
that is a statement about the world rather than about the quests), and the quest tab shows **one
dimmed line** when the bag is holding rows for another world, so the list being shorter than the
player remembers has a reason on screen and not only in the notice band.

**Abandon** is free, player-initiated, and pressed from the quest tab and **only** there: the board
takes work on and takes it back finished, and an abandon offered there would be an abandon offered
at the one moment the player is most likely to mis-press. It carries **no board gate and no mode
gate**, and both absences are deliberate — the panel is open only in walk mode and is closed under
the loading gate, and the mutator's own `_live` refuses under the gate and under a generation
mismatch, so a second copy of those guards would be unreachable code standing where a real one used
to. A row that left the list between the paint and the press is refused by id and comes back as
`abandon-unknown`; the generation fence answers with the same value on purpose, because from the
player's side a block that moved under them and a row that was never there are the same fact.

### 9.4 Caps, and the refusals a player can actually reach

The quest caps were already in §1.2's table and none of them moved; what 0.13 adds is a reader who
can hit them.

| cap                  | value | behaviour                                                                              |
| -------------------- | ----- | -------------------------------------------------------------------------------------- |
| `CAPS.activeQuests`  | 10    | **refuse** — `quest("accept")` returns `false`; the board renders the offer `at-cap`    |
| `CAPS.packDone`      | 40    | **evict** — the least-earned `p:` counter goes to make room                            |
| `CAPS.boardDone`     | 40    | **evict** — the least-earned `b:` counter goes to make room                            |

Eviction is **least-earned, not oldest**: a completion counter carries no day to sort by, so "oldest
key" was alphabetical order dressed up as recency, and a counter at 1 is the cheaper loss than one
the player earned nine times. Both maps are drawn as **bounded tallies** that say so at the bound —
"Only the last 40 kinds of work are kept." — because a full map is a list that has already lost
something, and a tally the player could read as a complete history would be lying quietly.

**The refusal map is ONE map, read from both surfaces** (`70-hud.js` `boardRefusal`). Every reason in
it is a reason about a JOB, and the two places a job can be pressed answer them identically; a second
map for the tab is how one of them comes to say something the other does not.

| reason            | what the player reads                                                        |
| ----------------- | ------------------------------------------------------------------------------ |
| `wrong-mode`      | Not while you're talking — resume walking first                                |
| `gate-held`       | Not yet — your world is still being written.                                   |
| `at-cap`          | Your job list is full — finish or set aside a job first.                       |
| `taken`           | You took that one today — it is on your jobs list.                             |
| `filled`          | That work is done for today — the board posts it again another day.            |
| `dup`             | You are already on that one.                                                   |
| `not-done`        | That one isn't finished yet.                                                   |
| `unknown-id`      | That job is no longer on your list.                                            |
| `abandon-unknown` | That job is no longer on your list.                                            |
| _anything else_   | There is nothing to do at the board just now.                                  |

Two things about that table are deliberate. **The at-cap copy names both reliefs** and both are
built — finishing is the board's own hand-in, setting aside is the quest tab's per-row confirm — so
at-cap-as-steady-state is the hoarder's own equilibrium rather than a forced loss: offers cost
nothing to ignore and never expire. And **`not-at-board` and `no-world` are absent on purpose**, on
`fishRefusal`'s rule: the button is not on screen where there is no board, so a line for them would
be copy nobody can reach — which is exactly why the fall-through has to be a real sentence.

### 9.5 What a rewind does to a quest — mode-qualified

Quest state is in the block, and the block rides the route-anchored snapshot, so a quest inherits
the save's rewind story exactly and adds nothing to it. Stated in the same two halves §11 uses for
fishing, because a reader who only reads one of them will be wrong:

**Routes mode.** A rewound turn **un-accepts** an accept and **un-completes** a completion, along
with the money it paid, the counter it incremented and the rapport it bumped — because all four are
fields of the same block the anchor row carries. The ledger lines go with them. The day's fill
receipt goes too: `_rebuild` replaces the sim wholesale and the receipt lives on the sim, which is
the honest pairing (a rewind that un-completes the quest un-files the receipt for it). A same-window
replay re-mints the **same instance id**, because the id is `(board, day, template)` and none of the
three moved.

**Metadata mode.** The store does not rewind at all, so the money, the completion counters, the
rapport and the ledger stay exactly where the play left them while the STORY rewinds around them.
The journal becomes a permanent record that can diverge from the narration — the same shape 0.12's
wrap-up carries, inherited from the store rather than introduced here. There is nothing the package
can do about it from this side; §11 records it, and the Engine gap it names is the same one.

**One thing does NOT rewind in either mode, and it is not a quest field.** A `deliver` errand costs a
GM call at handover. A rewind can take back the completion; it cannot take back the call.

---

## 10. Sizes: measured, not budgeted

**There is no design budget** (maintainer ruling). The earlier hard "24 KB snapshot / 24 KB bag"
figures were inherited caution from a mobile-payload worry, and budget-driven caps are what make
settlements feel tiny. Sizes are **measured** — harness case (ah) prints a saturated world's block,
snapshot and teardown-pair bytes against the two save walls on every run, and the per-release tables
below are measured the same way, off the shipped serializer and the shipped seal — and asserted only
against the walls that are real:

| wall                           | value                                                                            | why it is real                                                                                                                             |
| ------------------------------ | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Engine per-row cap             | 262,144 chars (`MAX_EXPERIENCE_STATE_CHARS`; mirrored as `MAX_SNAPSHOT_CHARS`)   | the server 422s above it, and the client pre-flight exists only to keep that 422's retry loop unreachable                                  |
| keepalive pair quota           | 57,000 bytes, **pagehide teardown path only**                                    | the Fetch standard caps TOTAL in-flight keepalive body bytes at 64 KiB per origin, and routes mode sends TWO bodies against that one quota |
| quarantine bag tripwire        | 131,072 chars                                                                    | a pathological blob bloating chat metadata; never fires at realistic severance sizes                                                       |
| generation `userContent` clamp | 8,000 chars (package cuts at 7,800; the payload sent is 7,801 with the ellipsis) | the Engine route's own schema — a different verb, unaffected by any of the above                                                           |

The two save walls bind **different paths** and that is the point: an ordinary flush is bounded by the
server cap alone; the pair budget binds only the write a dying page fires. When the pair does not fit,
the PUT goes **alone** — losing the write-through cache is a repairable inconvenience, losing both is
the session. A saturated world is over the pair quota and under the row cap by a wide margin, which
is exactly the documented behaviour rather than a failure.

The gate itself is `2 × TextEncoder(serialized).length ≤ 57,000`, measured on the SNAPSHOT string and
nothing else, so the number carries its own headroom rather than trying to be exact. What that
headroom has to cover on top of the two snapshots: the two JSON wrappers (`{"state":…}` and
`{"pixelforge":…}`, ~26 bytes together), plus 18 more body bytes for the `schemaVersion` column the
PUT now carries (§2.7 — 24 at a seven-digit value), plus whatever else the page has in flight at
unload. 57,000 against the standard's 65,536 leaves ~8.5 KB for all of it.

Collection caps (§1.2) are gameplay and hygiene bounds chosen for feel — staleness eviction, dedupe,
rollover — never for bytes. Size optimisation is explicitly deferred: if size ever becomes a felt
problem, that is a later measurement phase, not a reason to shrink the world to fit a number.

### 10.1 What 0.12 added to the wire, measured

The first release to write into the block is also the first chance to check the "measured, not
budgeted" claim against something that actually grew:

| what                        | shape                                                                   | measured                                                                                                              |
| --------------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------- |
| `skills.verbs.fishing`      | `{l, x}`, one entry per verb the player has practised                   | two small integers; one verb ships                                                                                     |
| `skills.equipped.fishing`   | `{tool: [t, k], mod: [t, k]}`, pairs by value                            | two short string pairs at most, and the `mod` slot is empty whenever a session is not running                          |
| pouch rows for the new types | `{t, q, k}` per `(t, k)` — one row per rod tier, one per bait kind, one per catch variant | worst case **22 rows against `CAPS.items` 60**: 19 distinct `(role, variant)` pairs across BOTH shipped theme table sets (the pouch is world-free, so a chat that changed theme can hold rows from both), plus two rod tiers and the lodging key |
| `intro.ledgerOwed`          | one integer, inside the envelope's existing `intro` key (§8.1)           | no new envelope key, and absent from the block entirely                                                                |
| `ledger.notices`            | `[day, text]` / `[day, text, 1]`, emitted only when non-empty            | ≤ `CAPS.notices` 12 rows × `CAPS.ledgerChars` 200 chars = **2,400 chars of text at absolute maximum**, and 0 bytes on a block that has never had anything explained to it |

**No `bought` row is listed, and its absence is the point:** the rod purchase writes nothing there,
because `bought` counts what a named shop's stock has lost and 0.12 ships no shop stock — the berth
precedent exactly (§7.7).

`TUNING.ledgerTellChars` is not a save size at all; it is a metering bound on one prompt part, in
the same class as `ledgerChars`, and it is floor-asserted at load (§7.1, §8.4) rather than capped
from above. Everything above is far under both real walls, which is what the table is for: it says
the growth was measured, not that a number was defended.

**On write amplification**, since it will come up: "rewrite only changed chunks" is not
package-controllable. Each anchor row is a _full_ snapshot by design — that completeness is what makes
rewind work — and the engine's file-backed store re-serializes the chat's whole `game_engine_state`
shard on any write. Delta rows or chunked shard writes would be an engine storage change. Package-side
the levers are the ones already pulled: small blocks, short keys, caps, and prose held to the capped
`s` lines.

### 10.2 What 0.13 added to the wire, measured

**The headline is a subtraction.** 0.13 added **no new key** to the player block and none to the
envelope. `quests_done_board` and `quests.done_pack`/`quests.active` were declared empty by
`defaultPlayer()` in 0.11 and have been riding the wire ever since; the quest layer is the first
release to put anything in them. So the pinned wire literal (§2.4) does not move for a block that has
never taken work, and every number below is growth on a block that has.

| what                          | shape                                                                         | measured                                                                                                                                    |
| ----------------------------- | ------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------- |
| one `quests.active` row       | `{id, g, verb, target, n, have, r: {money, xp}, day}` — the closed eight-field literal | **147 bytes** serialized for a REPRESENTATIVE row — a `b1.d12.p:<hash>:<slug>` instance id, a `zoneId\|Giver` handle, a catch role and a derived reward. Not a constant: the id, the giver's name and the day are what vary, and legal rows run **123-201 bytes** across them |
| `quests.active`, at the cap   | `CAPS.activeQuests` 10 rows                                                    | **1,481 bytes** on that representative row — 10 × 147, plus the 11 the array itself costs (two brackets, nine commas) — and the cap REFUSES rather than evicting, so this is a real ceiling and not a preference |
| one `quests.done_pack` entry  | `"p:<hash>:<slug>": <count>`                                                  | **27 bytes** at the exemplar key shape — a 6-char pack hash and a 14-char slug, which is what `catch-common-3` measures; at `CAPS.packDone` 40 of that shape, **1,121 bytes** |
| one `quests_done_board` entry | `"b:<slug>": <count>`                                                         | **20 bytes** at the same 14-char slug; at `CAPS.boardDone` 40, **841 bytes** — a theoretical ceiling: only **eight** `b:` templates ship, so forty rows cannot occur in play |
| ledger lines                  | one per accept, one per completion, one per abandon, **zero per progress**     | no new field and no new cap — they land in `ledger.lines` under `CAPS.ledgerPerDay` 15 and `CAPS.ledgerChars` 200, exactly as fishing's do   |

**Worst case for the whole quest layer inside the block is ~3.4 KB** — 1,481 + 1,121 + 841 = **3,443
bytes** with 10 active rows and both completion maps full, of which 3,437 is GROWTH, since the three
empty keys ride the wire already. Against a 262,144-char row cap that is **1.3%**. Every cell above
shares ONE key shape, which is what this table got wrong before: the at-cap figures were measured on
a narrower slug than the per-entry figures beside them, so the two halves of the same row disagreed
by 330 bytes each. The thesis never needed the smaller number — it is the same "measured, not
defended" point §10.1 makes, one release along.

**And the pack is NOT in the block, which is the number that matters most here.** It is a chat
metadata key of its own (§9.2), so it never enters `snapshot()`, never counts against the Engine's
per-row cap, and never rides the keepalive pair quota — the two walls at the top of this section
are untouched by it.

| pack                          | measured                                                                                                     |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| the shipped **default** pack  | **5,475 bytes** (cozy-village) and **5,558 bytes** (sci-fi-colony), each 8 templates, 32 lines, 4 escalation rows and 6 overheard — and neither is ever stored, since the default pack is a read-time fallback |
| a **sealed** pack, in practice | bounded by the generation fit rather than by a cap: the arithmetic beside `TUNING`'s floors sizes a typical emission at the ~4K-token ceiling, and a floor connection's is smaller still |
| a sealed pack at every validate cap | **93-107 KB** — 24 templates, 320 lines, 12 escalation rows, 24 overheard, every string at its own cap, sealed clean with no repair lines. It is a BAND rather than a number because the caps bound the STRINGS and leave the enum and grain words free: 93,003 bytes at the cheapest legal ones (a `visit` at a `place`; `hall`/`day`/`friend` index rows carrying neither optional axis) and 107,303 at the widest (`deliver`, a 24-char giver, a 24-char cast name as the target; `settlement`/`night`/`stranger` rows carrying both), with the briefHash's own digit count worth ~80 bytes inside either. Reachable only by a model emitting ~31-36K tokens in one reply, which no connection this package talks to will do; the caps are seal-time validate bounds, not a budget |

**There is no storage budget for the pack, deliberately** — the only real budget is the generation
fit, the caps are what `validate()` refuses above, and **a sealed blob never grows**: it is written
once and read forever. What a full-cap pack would cost is written down anyway, because a number
nobody has looked at is how a "no budget" decision turns into a surprise.

### 10.3 What 0.14 added to the wire, measured

**The headline is another subtraction, and a bigger one than 0.13's.** 0.14 added **no key to the
player block and no field to the save envelope at all.** Weather is a pure function of
`(seed, day, override)`, the climate axes are a runtime stamp re-minted on every compile, the
dialogue window's latch is runtime-only, and the GM override lives in chat metadata. The pinned wire
literal does not move by one byte for any of it.

So everything below is growth somewhere *other* than the block, and the section says which wall each
number is measured against — because they are different walls and two of the three are not walls at
all.

**Every figure is measured on one ruler**: `Buffer.byteLength(JSON.stringify(x), "utf8")` for stored
artifacts, and plain character counts for prompt text. Where a number is a range rather than a value,
it is written as a range.

| what | where it lands | measured |
| ---- | -------------- | -------- |
| the header's two new words | the **prompt**, every turn, permanently | **14 to 24 chars per turn.** The paren group went from `(<daypart>)` to `(<daypart>, <weather>, <season>)`, so the growth is 4 chars of separator plus the two words. The weather label runs 4 (`fair`) to 10 (`light rain`, `heavy rain`, `light snow`, `heavy snow`), the season word 6 (`spring`) to 10 (`wet season`). A range and not a number, because the label is intensity-variable |
| the `pixelforgeWeather` metadata row | **chat metadata**, and only when a writer exists to write it | **38 bytes** for `{"word":"storm"}` with its key name; **52** with a two-digit `sinceDay`; **85** with `word` + `intensity` + `sinceDay` + `untilDay` at two digits each. Day numbers are not capped — `positiveDay()` takes any safe integer — so the true maximum is **113** at `Number.MAX_SAFE_INTEGER` days. Nothing in 0.14 writes it |
| the generation digest's climate pair | the **generation request**, once per world | **+2 rows, 21 → 23**, and **136 chars** at their widest (a temperate/moderate world, whose reachable-word list is the longest). The digest's whole worst case is pinned at **2,718 chars** against a `userContent` clamp of 8,000 |
| a pack line's `w` tag | the **sealed pack**, on new packs only | the widest legal line row is **294 bytes** serialized — a 200-char line carrying both the topic tag and the sky tag, on the widest handle the location vocabulary names (`settlement`, ten characters). Measured and pinned, not rounded |
| the default packs' enrichment | **nothing stored** — the default pack is a read-time fallback and is never written | cozy-village **5,475 → 8,705 bytes** (+3,230) and sci-fi-colony **5,558 → 8,844** (+3,286), each going from 32 lines to **56** to carry the coverage floor of two any-weather stranger lines per (handle × topic) |
| the substance floor | which generations become permanent artifacts at all | `floorLines` **12 → 10** (ruled). Not a size; a decision about what seals |

**Three of those five land in the prompt rather than in storage, and that is the release's real
cost.** The header's two words are the only *permanent per-turn* growth 0.14 adds, and at 14-24
chars they are the cheapest thing on this page — but they are paid on every turn forever, which is a
different shape of cost from a blob written once. **The per-session TOKEN total is deliberately not
in this table**: characters are what this document can measure honestly, tokens are what a live
connection charges, and the live half is owed on the deferred list (§12.2).

**And the two save walls at the top of this section are untouched.** The block did not grow, the
envelope did not grow, and the metadata key — like the content pack before it — never enters
`snapshot()`, so it counts against neither the per-row cap nor the keepalive pair quota.

---

## 11. Accepted limitations

Mirrored from the S5 plan's own table. These are decisions, not oversights.

| limitation                                                                                                                                                                                                                                                                 | status                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| pre-S5 builds delete the block on first flush                                                                                                                                                                                                                              | accepted                                                                       |
| metadata mode never rewinds; a checkpoint load does not restore there                                                                                                                                                                                                      | engine gap                                                                     |
| probe-failed session: rewind off; pinned play lost at the next routes boot unless promoted                                                                                                                                                                                 | accepted **until a tagged Engine release carries #5406** (merged to `staging`) |
| #5406 seam residual: a degraded session that sent NO narration leaves the anchor unmoved (`anchorMatched: true`), so the route row still wins the boot comparison and that session's metadata-only writes are lost — the ordinal cures only the anchor-moved degraded case | accepted; unchanged from pre-seam behaviour                                    |
| a lost flush after an accepted sleep, or a rewind across a sleep, can re-tell a day                                                                                                                                                                                        | **accepted (maintainer)**                                                      |
| unslept days beyond three survive as stubs                                                                                                                                                                                                                                 | **accepted (maintainer)**                                                      |
| corrupt row contents unrecoverable client-side                                                                                                                                                                                                                             | accepted **until a tagged Engine release carries #5407** (merged to `staging`) |
| a generation failure blocks play behind a retry screen — no sandbox world                                                                                                                                                                                                  | **by choice (maintainer)**                                                     |
| the GET→PUT race is narrowed, not closed; a teardown after an undetected seam can still overwrite                                                                                                                                                                          | accepted                                                                       |
| an intra-message swipe-compare rewinds offline actions                                                                                                                                                                                                                     | pair-anchoring by design                                                       |
| a sealed brief lost while the tab was closed → an explicit player choice to regenerate                                                                                                                                                                                     | accepted                                                                       |
| prune is write-recency; pre-#5102 checkpoints restore nothing                                                                                                                                                                                                              | engine behaviour                                                               |
| multi-tab last-write-wins                                                                                                                                                                                                                                                  | alpha                                                                          |

Added by 0.12, and every one of them is a decision the design round took on the record:

| limitation (0.12)                                                                                                                                                                                                                                          | status                                          |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------- |
| **two never-flush classes**: the player who never rents a bed, and the player who only ever Waits. Neither ever stages a day, so the ledger accumulates and is never told. The first flush after many buffered days tells stubs for the elided ones          | **accepted**; the roadmap's sleep-deprivation debuff (P10) is the fix |
| **routes mode**: a rewound turn un-catches the fish, and a same-window replay re-catches identically. **metadata mode**: the ledger does not rewind, so a rewind across a sleep loses that wrap-up and the journal becomes a permanent record that can diverge from the story | mode-qualified; inherited from the store, not new |
| a **guard refusal after an ACCEPTED send** (rebuild-class interleavings only) leaves the tell in history un-burned and the next compose re-tells it. The sender swallows it: no toast, no retry                                                              | **by design** (§8.2)                            |
| **concurrent senders** can tell the same wrap-up twice in one history — equal `throughDay`s both pass the guard and the second burn is a no-op                                                                                                              | accepted (§8.4)                                 |
| a **0.11 client visit drops `intro.ledgerOwed`** — but the next completed 0.12 sleep re-stages every still-retained day, so the loss is a **DELAY**, permanent only for lines that age out of `ledgerDays` first or for a player who never sleeps again      | accepted; all other 0.12 state round-trips 0.11 losslessly |
| a **0.11 client visit STRIPS `ledger.notices`** — its serialize rebuilds `ledger = {lines}` — and pending notices are lost permanently. Unlike `ledgerOwed` there is **no self-heal**                                                                        | accepted; informational strings, small blast radius |
| a **brief severance drops the band's pending notices permanently**. Pre-0.12 notice LINES were parked in quarantine and restorable; the band is not parked and cannot be (§1.1)                                                                             | accepted; the format change bought re-readability and cost this |
| **pre-0.12 notice lines already in saves stay unmarked forever** and render inside the day groups rather than in the band                                                                                                                                   | one-time historical residue                     |
| a world sealed **without water** offers no fishing at all — reachable, since the only seal floor is the wilds landmark-stone. `surround: "water"` is prose and density only and paints no water                                                             | accepted; the berth's precedent — no verb has a floor |
| **`fine` and `masterwork` rods are unobtainable** in 0.12 and mod grading is presence-only, so two tool multipliers and the graded-mod tier are dormant content                                                                                             | by scope                                        |
| **no rod is ever free**; a rodless player at water sees the button and gets a vendor-pointing refusal. Sci-fi's keeper premium is an **INTERIM** until the device/online-shopping mechanic takes that acquisition                                            | **maintainer ruling (amended)**                 |
| the purchase is never forced and skippable indefinitely — but 0.12 ships **no income mechanic**, so a player who spends the whole starting purse before buying is priced out of fishing until income lands. No affordability coupling is asserted anywhere    | **maintainer override**; refusable, never broken. **0.13 unlocks it**: quest completion is the first income mechanic, and nothing couples it to owning a rod — `visit` and `deliver` pay for a walk and a greeting, and half the default pack's eight templates are one or the other. Still no affordability coupling anywhere, which is the point: the way back to the money exists without being arranged |
| **sci-fi fishing is real fishing** with flavoured variants beside real fish; the well is not a fishing spot                                                                                                                                                 | **maintainer ruling**                           |
| the character sheet's portrait may render **Tier-0 art for a frame-class window** before assets are ready (self-heals through the value key), and beneath it is a themed generic label until the engine exposes a persona name and avatar                    | accepted; one enumerated Engine FR              |
| the fishing **trigger UX** and the **journal panel's shape** are ruled *provisionally* — conclusive at the 0.12 playtest                                                                                                                                    | named playtest-checklist items                  |

Added by 0.13, and the same rule holds: every one of them is a decision somebody took on the record.

| limitation (0.13)                                                                                                                                                                                                                                                             | status                                                    |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- |
| **every chat sealed before 0.13 is PACKLESS, permanently.** The seal-side marker is written by the seal PATCH, and a brief sealed by an earlier client wrote none — so no pack is ever expected, no paid call is ever armed, and the board renders its own honest empty state ("No work posted here", never "not yet", never "check back"). The same is true both ways across a mixed-version creation cycle: a pre-0.13 chat sealed by an 0.13 client, and an 0.13 chat sealed by an 0.12 one, are both packless | **maintainer ruling (Q9)** — see the note below this table |
| the Engine's own Game-Mode **quest tracker is a second, DISJOINT quest surface** reachable in the same chat — it lives in the **Marinara-Engine** repository (`packages/client/src/features/tracker-panel/…/quest-tracker/`), not in this one. Nothing bridges them: a job on this board never appears there, a quest tracked there is invisible here, and neither can complete the other's | **disjoint by design**; bridging is ROADMAP P7's territory  |
| the day's **fill receipt is sim-resident, not saved**, so a reload mid-day forgets it and the same template can be filled twice that day. It self-heals at midnight, and a rewind clears it deliberately (§9.3)                                                                | accepted; the alternative is a save field for a one-day rule |
| a **floor connection** (2,048 effective output tokens) whose model writes near the schema's cap on every row comes back under the substance floor on **every** attempt, so the retry screen is that player's steady state rather than a transient. The sizing target is the typical ~4K ceiling, where the same emission clears with room to spare | **accepted** (the degrade ladder's own posture); pinned by the max-shape lane |
| a truncated response too cut up for `salvageText` to close at all falls through to the ladder's `refused` branch, so the player is told the request was **turned down** when it was answered and lost. "Thin" would be the truer word                                          | **pre-existing**, inherited from the brief's ladder; recorded, not fixed |
| **`deliver` costs one GM call** at the handover — the one quest verb that is not GM-free. A rewind can take back the completion; it cannot take back the call                                                                                                                  | **by design** (Ruling 1 is "lean", not "zero")             |
| a template whose **giver is also its target** bumps the same person twice in one turn (once for the conversation, once for the errand)                                                                                                                                        | recorded harmless: a turn that was two things               |
| **givers are sealed-cast names only.** A city of ~120 souls has at most the sealed cast to post work, because a minted resident has no persona to speak with. Minted givers are E2/OQ11's future                                                                              | by scope                                                    |
| the verb enum accepts **four words and ships three mechanics** — `gather` folds to `catch` at seal, repair-logged — so a pack asking for gathering gets catching                                                                                                              | by design; the fold is recorded at the seal                 |
| **rewards are money and rapport only.** Character-level XP, tangible collectibles and reputation each await the system that would make them mean something (ROADMAP P4)                                                                                                        | **maintainer ruling**                                       |
| a **foreign save's pre-existing skills ladder still renders**, quest-shaped verb rows included. The fence stops this build minting one; it cannot un-mint one that arrived                                                                                                     | pre-existing seam, recorded                                 |
| **metadata mode**: quest state does not rewind, so money paid, counters incremented and rapport bumped stay where play left them while the story rewinds around them (§9.5)                                                                                                    | mode-qualified; inherited from the store, not new           |

Added by 0.14, and the same rule again — every row is somebody's decision on the record:

| limitation (0.14) | status |
| ----------------- | ------ |
| **the GM weather override has no writer.** The read side is whole — fold, range predicate, reconciler, boot placement, the town's answer — and the only thing that can write the key is a browser console. The host dispatches capability events on engine-defined type strings only, so there is no surface a real writer can sit on | **by dependency**; the enumerated Engine FR is what unblocks it |
| **the override does not rewind with the story, and re-arms inside its own range.** `sinceDay` clamps the start, so a rewind to before it was set restores the derived sky; a rewind INTO `[sinceDay, untilDay]` re-arms it — which is that day's own first-pass sky. A cleared range is gone | **accepted trade**: the alternative needs a save field, and weather has none by design |
| **the override key gets no self-heal.** It inherits the #5076 whole-blob-erase hazard like every package metadata key, and unlike the save and quarantine keys there is nothing to re-derive it from. A vanished row reads as "no override", never as corruption | accepted; a future writer re-writes rather than repairs |
| **an override files no ledger line.** The notable-sky park fires only on a LIVE day crossing, so a sky summoned mid-day changes the header, the tint, the bias and the bite immediately and records nothing. Same for an expiry | **by design** (the park is mover-only, which is what keeps a reload silent) |
| **the friend register is sealed and unread.** Ruling 4: 0.14 serves the stranger register only. On the live measured pack that is 7 of 12 lines written and never served (5 stranger served, 7 friend sealed) | **maintainer ruling**; the relationship ledger (ROADMAP P2) is what reads it |
| **the overheard pool is still unread.** 0.13 sealed it; 0.14 does not surface it either | by scope |
| **the window is invisible to the GM.** Every free branch is a zero-call lookup, so the narrator is never told a conversation happened, how long it ran, or what was said. Only the four paid doors reach the model | **by design** — this is the Call-economy pillar's whole point, and it is also the risk the playtest exists to answer |
| **topic branches are suppressed on a thin generated pack — the paid-path inversion.** The default packs carry a coverage floor and render all four branches; a sealed pack renders only what it can answer, and there is no merge. So a legacy world or a declined generation is the RICHER conversation, and the world that paid two GM calls is the poorer one | **accepted, knowingly**, and named at all four sites. The fix is a wider generation (shipped in 0.14) and a floor at 10, not a merge |
| **the schema-max thin residual is two lines wide.** A model writing at the schema's cap on every row, truncated at the 2,048-token wall, salvages the whole template list and **eight** lines against a ruled floor of **ten**. That two is the entire margin — a floor at eight would flip this lane from a documented limitation into a silently sealing one | **accepted**, and pinned by value so the margin is a red rather than a discovery |
| **the Say field is uncapped.** The package imposes no length limit; a host refusal surfaces as the generic refusal toast and **the typed text is not preserved**. The downstream bound is not something this package can see | **ruled** (B2-3c); the honest form, and the revisit is on the roadmap |
| **no outdoor-job flag exists**, so the schedule bias is coarse in both directions: an outdoor-posted scholar is exempt exactly like the shepherd, because the test reads the schedule policy's NAME and never an NPC's identity | by scope; the trade half of the kind split (ROADMAP E3) is the handle |
| **fallback posts are exempt too.** `post` is also the compiler's anchor for somebody with no job at all, so the owner-of-nothing stands in the plaza the bias is emptying — and a live-work owner stands on their own doorstep, through the storm | recorded; a felt-behaviour question for the playtest, not one a table can answer |
| **the destitute stand in the weather.** Their row is `post` at every daypart and the compiler places them in the town's public centre. So does anyone with no fireside to go to — a lodger in a named place's quarters, a wilds resident | **by design**; nowhere to go is answered by standing in the weather, not by teleporting nowhere |
| **the bias is a no-op on legacy worlds**, whose NPCs carry no schedule handles at all | inherited; schedules have always been compile-time-only |
| **the bias and every catch consumer are intensity-blind.** Light rain empties the street exactly as heavy rain does, and heavy rain bites like light rain. Intensity reaches the header label, the rain tint and the falling pass, and stops | **by design**; a drizzle reads as weather, not as an exception |
| **a polar world never reaches the storm catch column.** The warmth gate makes a thunderstorm arithmetically impossible at polar latitude in every season and every precipitation, so the release's one authored "fish the storm" hook is unreachable there. Arid four-season worlds meet it about once a year | recorded content reachability, not a bug |
| **spring and autumn are the same sky**, byte for byte, in every four-structure band × precipitation pair — the temperature phase is symmetric about the shoulders and four-season wetness is flat. Four season names buy three distinct skies per band | **recorded decision**; a one-array retune if a playtest wants autumn wetter |
| **a two-season world's "wet season" is precipitation-RELATIVE.** An arid tropic's wet half is its storm-leaning half, not a monsoon | naming honesty, stated rather than renamed |
| **the season-structure mapping is an INTERPRETATION** — two flat seasons at the equator and the tropics, four poleward — implemented as read from the ruling | **flagged to the maintainer** (B2-2), his to amend; on the deferred list |
| **"First snow." is scoped to the days the world has LIVED.** A world whose calendar opens mid-winter counts firsts from day 1, not from the season's unlived start | **by design**; the floor is what keeps the scan off phantom pre-world time |
| **a distribution or coefficient retune re-skies unpinned worlds** on their next load, and can strand a sealed pack's weather-tagged lines. It costs pack content, not only the sky | the rolling-compat class; the brief hint is the opt-out |
| **mobility under an open window is a couple of steps, not freedom.** The window opens inside 26px and closes at 32px, so the affordance is one tile of slack and not a walk | stated so it is not oversold; the feel is on the deferred list |
| **the capacity guard's coverage is arithmetic luck of the count.** It catches a tile sheet too SMALL for its id map — 33 ids into 32 slots after the 0.14 bake. Three appended painters instead of four would have landed in bounds and slipped past it | recorded honestly at the guard |

Added by 0.15 — the release where `d` is written by play for the first time, which is what
turns three long-standing shapes into things a player can reach:

| limitation (0.15) | status |
| ----------------- | ------ |
| **the row cap gains a refusal class it never had.** `_evictStranger` only takes rows at `d 0`, and three encounters now lift a row off that tier for good. So a player who greets 150 different people three times each fills `relRows` with **un-evictable acquaintances**, and every further `bump()` refuses in silence — a new person simply is not remembered. Before 0.15 nothing moved `d`, so every row stayed evictable forever and the cap could always make room | **accepted (alpha)**; the cap is 150 rows across all zones and the refusal is silent by design (§3). The relief is a demotion verb or an eviction preference that reads `t` as well as `d` — both S1's |
| **the ask ladder's served set is shared across speakers.** It is keyed by (day, BRANCH) and never by person (0.14's memo shape), so a friend's presses spend lines an acquaintance standing in the same square would otherwise have been served. The stranger-path "byte for byte" claim is therefore scoped: it holds exactly in a town where **nobody** is a friend, and the harness's own friend-register case has to order its assertions around the shared pool | **by design**, inherited from 0.14 and unchanged; recorded now that a second register can spend from the same pool |
| **the one-per-day reload exploit pays triple what it did.** The day's fill receipt is sim-resident and not saved (0.13's row above), so a reload forgets it and the same template can be filled again — and since 0.15 that refill pays **3 rapport** as well as the money, which is a real rung every few reloads rather than a tally | **inherited and unchanged**; the alternative is still a save field for a one-day rule |

**On the packless row, and it is a posture rather than a debt.** The compatibility window **rolls
with the game**: legacy grows as the game grows, old-alpha worlds are never re-supported, and at
full release the floor reaches back at most to late-Beta worlds. So a world-compat row in this
document is honesty documentation for the CURRENT era's saves and never a promise to older ones. The
0.14 retro-generation idea — a per-chat, player-initiated "write work for this world?" opt-in, which
is exactly why the board fixture is unconditional — is a **convenience for recent worlds, not an
obligation to old ones**, and it is recorded on the roadmap with that caveat attached.

Two of these name **filed** Engine FRs — **#5406** (authoritative write ordering) and **#5407**
(`rawState` on parse failure). Both are **merged to Engine `staging`** but not yet in a tagged
release, and this package's `builtAgainst` 2.4.3 predates them; §5.2 and §5.4 describe the client
readers that are already in place and dormant until an Engine release carries the fields.

**Two further Engine asks are enumerated but not filed**, both from 0.12's panels and neither
blocking anything:

- **persona name and avatar exposure.** The chat has a persona with a name and an image; the
  package's props carry neither, so the character sheet draws the walk sprite and captions it
  with a themed generic label (§8.5). A package that could read them would put the player's own
  face on their own sheet.
- **a package slot in the inventory panel.** The engine draws its own inventory and the package
  draws its own pouch, and they are different bags. A slot an experience could render into would
  at least put the two in one place for the player — the cheapest honest version of that
  reconciliation, and one that does not require settling the wider narrated-transactions question
  first (ROADMAP P7).

---

## 12. Deferred verification — what is not proven, and who owes it

**This list exists so nothing here is discovered by a player.** Everything above is asserted by the
harness or read off the source; what follows is the complement — the claims the harness structurally
cannot reach, gathered in one place instead of scattered across commit messages. **This is the only
such list in this document.** Nothing on it is checked off here: these are somebody's outstanding
items, and every entry says whose.

Rebuilt for 0.14. Items the release answered are recorded as answered rather than deleted, because
"what was owed and how it came out" is the half a reader cannot reconstruct.

### 12.1 The live generation ladder — PARTLY ANSWERED, and the answer changed the design

**This section used to say nobody had run the ladder against a real connection. That is no longer
true, and the correction matters more than the original claim did.** A first live two-call
generation ran on **2026-08-28**, and it is the data 0.14's dialogue design is built on:

- **The ladder passed end-to-end.** The brief call and the pack call ran under one hold, the retry
  behaved, and the purse was paid once.
- **A real model honors templates-first.** That was the one thing only a real model could answer,
  and the floor arithmetic's best-effort assumption held.
- **The LINES side starves under truncation.** One thin attempt came back 12 templates / 4 lines;
  the attempt that sealed came back 5 templates / **12 lines — exactly at the old floor of 12**,
  with nothing to spare.
- **And the shape of those 12 lines is what forced 0.14's fallback layering.** By topic:
  7 untagged / 2 work / 3 rumor — **zero place, zero smalltalk**. By register:
  5 stranger / 7 friend, and under ruling 4 the 7 friend lines stay sealed unread. Against 4
  location handles × 4 dayparts that is a per-(location, daypart) slot density **below 1** at floor
  size.

That is why the selection ladder relaxes as hard as it does, why suppression is honest rather than
padded, why the guidance was widened and inverted, and why the floor came down to 10. A single live
run rewrote a design; it is worth saying so.

**What is still owed, and it is now a 0.14 question rather than a 0.13 one:** a live two-call
generation **under the widened schema and guidance**, measuring the topic and `w` density the four
new asks actually get, the stranger share under the inverted register sentence, and the 140-char
line cost against the ruled floor of 10. The mock lanes prove the machinery; only a model proves the
guidance.

Beside it, the **per-session token cost of the permanent header words**. The chars-per-turn
measurement ships in §10.3 (14-24 chars); what a live session is actually billed for two extra words
on every turn is the half a real connection has to answer.

**Owed by:** the maintainer, at the first live 0.14 creation. Not a code gate — the first thing a
real chat does.

### 12.2 The browser pass

The harness DOM shim has no layout, no scroll, no focus and no animation frame. Everything below is
asserted only as far as the **write** — that the package sets the property — and the part that
matters to a player is on the other side of that line.

**0.14's own items, and the flagship surface is most of them:**

1. **The dialogue window's shape and placement.** It is a partial panel with constraints the design
   fixed — clear of the topbar, the action rail and the d-pad — but the look is a browser
   question. Specifically: **does it occlude the host's narration panel mid-story?** A window that
   covers the thing you are reading is worse than a menu.
2. **The window at mobile width.** The row list runs to a title, up to two record branches, up to
   four topics, an escalation pair, a hand-over per errand, "Just talk", the Say field and Leave.
   Nothing has drawn that at a phone's width, and the rail reserves 268px beside it while it is
   open.
3. **The one-tile band's feel.** The window opens inside 26px and closes at 32px. Does 32 read as
   *stepped away* or as twitchy — and how does the six-pixel sliver between them feel, where the
   census label is **dimmed to 0.45 and still live**, so a press in it silently no-ops? The number
   is the ruling's; the feel is the maintainer's eye.
4. **The time-stop's feel.** The clock face frozen mid-conversation while the town keeps milling and
   the rain keeps falling. It reads as intended on paper; nobody has watched it.
5. **Input focus versus host keys.** Keyboard focus moving through the window's buttons, Escape
   closing from a focused control rather than only from the body, and specifically **Space on a
   focused window button while walking** — the one collision the shim cannot stage.
6. **Heavy versus light, by eye, both themes.** Light rain against heavy rain, light snow against
   heavy snow. "Visually distinct" is accepted only when an eye says so, and the tint alphas and
   particle counts (45 at fall 1.0 versus 120 at 1.7) are guesses until then.
7. **The snow tiles, both themes and both tiers** — including the colony's own `cropSnow` and
   `canopySnow` shapes, which must not fall through to the cozy painters.
8. **Tint values by eye at noon and at night**, where the storm tint compounds with the darkness
   ramp.
9. **The grass-fill strip on EXISTING worlds — `fence`, `trunk` and `well` on paved ground, on a
   FAIR day, both themes.** This is the one deliberate look change 0.14 makes to worlds that already
   exist, and it is everywhere: objects no longer lay their own patch of grass, so the ground under
   them is whatever they are standing on. Verified by eye rather than discovered — and this is also
   the maintainer's chance to overrule the strip-versus-repaint call.
10. **The header's wording** at its real width, with the two new words in the paren group.
11. **The notable-weather drain, on a real animation frame.** The sim parks `{text, day}` rows and a
    frame files them; the shim runs no rAF, so the queue's four-deep cap, the day riding with each
    row, and the drain firing at all are pinned only as far as the splice.
12. **The retry screen's strings and the window's labels at width** — the pack-stage title, the
    waiting body, the two-sentence failed-state body, and the window's own row labels, all pinned as
    strings and never measured against the panel they sit in.

**And the metadata path END-TO-END, once, which the console recipe deliberately does not cover.**
The documented incantation touches the runtime slot only, by design. What wants proving is the real
path: patch the chat metadata with
`{ pixelforgeWeather: { word: "storm", sinceDay: <day> } }`, and watch the props delivery arrive,
the reconciler assign and re-resolve **exactly once**, the town answer, and a reload restore the same
sky from the row.

**Still owed from 0.13**, unchanged and not superseded: the journal tab strip at mobile width, the
scroll reset on a tab switch, the abandon confirm's arming feel, the board receipt line's
legibility, a long job list at a real height, the tally glyphs, and **tab focus and Escape** through
the strip.

**Owed by:** whoever runs the browser lane before the release goes out — the maintainer, or a
contributor doing it on their behalf. This package ships no browser test that covers any of it.

### 12.3 The maintainer's playtest — 0.12's still outstanding, and 0.14 adds its own

**Two 0.12 rulings are still PROVISIONAL, and now three releases have built on them.** The fishing
**trigger UX** (M5 — a proximity-gated button rather than a verb menu) and the **journal panel's
shape** (M11) were ruled provisionally, to be settled at a playtest that has not yet happened.
0.13's board button copies M5's pattern; 0.13's tab strip lives inside M11's panel; and 0.14's
window is a fourth proximity-gated surface in the same family. The exposure stays deliberately
contained — trigger-only gating, a thin list mechanism, a window whose latch is runtime-only — but
containment is a claim about the code, not a substitute for the playtest.

**0.14 ships with artwork IN and a playtest promised** (ruling 5), and these are the felt questions
it exists to answer:

- **The hearth-first bias.** *A storm morning moves the cast from beds to hearths and keeps them
  home — the streets empty, the houses lit: does that read as weather?* And the second half: does a
  gathering keeping only its own people read as right? The stampede worry is answered on paper — the
  wet 07:00 pass is the dusk pass run early, the same moves the town makes every evening — and paper
  is not an eye.
- **E7's whole risk, in the synthesis's own phrasing: did the free branches stop the maintainer
  reaching for the narrator?** That is the roadmap's question about this item and it is answerable
  only after play. A tree that swallows the door to the GM would trade the game's best feature for
  its cheapest one.
- **Whether honest suppression reads as a broken window** on a thin generated pack — the paid-path
  inversion, met by a player rather than described in a table.
- **The four-press window in practice**, and whether four bumps in one conversation feels like four
  encounters.
- **The season-structure interpretation, CONFIRMED or amended.** Two flat seasons at the equator and
  the tropics, four poleward, is an interpretation of the ruling flagged as one. It is implemented
  as read and it is his to change.
- **The art verdict** — the snow ground, the tints and the falling pass, at both tiers.

**The playtest recipe, and it is two recipes.** The sky is summonable directly, two lines:

```js
core.sim.weatherOverride = { word: "snow" }; // any of the five; rain/snow take intensity: "heavy"
core.sim.resolveSchedules(); // the second line is what moves the town
```

A **season crossing is a two-step**, and it has to be, for two reasons worth stating so the cost is
known rather than discovered. First, no hand-derived day offset is legal — spans are 92/91/91/91 and
183/182, so any constant no-ops from some starting positions and crosses nothing from others.
Second, **assigning `sim.day` is not a live mover**, so it can never fire the ledger line the
crossing exists to demonstrate:

```js
// 1. skip to a boundary EVE through the function, never a constant.
//    183 is the longest span, so the probe day sits at least one season ahead
//    whatever the structure; seasonStartDay then snaps to that season's true
//    first day, and -1 is its eve.
core.sim.day = PF.weather.seasonStartDay(core.sim.world, core.sim.day + 183) - 1;
core.sim.resolveSchedules();
// 2. cross the boundary with a LIVE mover, so the park fires: the rest verb (Wait...).
```

The skip itself parks nothing, and that is stated in the recipe so the missing ledger line is a
known cost rather than a mystery. The crossing then both relocates the town under the new season's
sky and files the notable line. It is a verification tool and not a shipped verb: every derived
system re-derives, the day-keyed memos purge on inequality, and the wrap-up's tell for the skipped
span is bounded to stub lines.

**One thing no playtest can settle, recorded here because it belongs to nobody else:** the Say
field's **downstream bound**. The package imposes no cap and cannot see what the host does with a
very long line — whether it is truncated, refused, or passed through. A refusal surfaces as the
generic toast and the typed text is not preserved. **Honestly unverified**, and it stays that way
until somebody with the engine side in view answers it.

**Owed by:** the maintainer. Until the 0.12 playtest happens both of its rulings stay provisional,
and a reshape after either is a scheduled cost rather than a regression.

### 12.4 Release prep — nothing currently owed

**This section flipped for 0.14 and has flipped back: the rebuild ran in-cycle rather than being
deferred.** The 0.14 arc was source-only by convention, exactly as 0.12 and 0.13 were — six slices
edited `src/` and `build/build-art.mjs` and left the build output for one rebuild at the end — and
that rebuild is committed. What it moved, and what was checked:

- **`client.js`**, at 1,173,739 bytes over eighteen modules, and the figure was **predicted before
  the build ran** from the blobs git stores rather than the files on disk. The prediction matched
  byte for byte, which is the check the 0.11.0 CRLF incident is the reason for.
- **Both theme tile sheets and `atlas.json`.** The sheet grew its fifth row — 33 ids over 8 columns,
  **128×64 → 128×80** — and the atlas went from 29 ids to 33, the four snow ids **appended** at
  29-32 with **not one existing index moved**. Pixel-diffed rather than trusted: of the 32 old
  slots, exactly six differ, and all six are accounted for — three that were empty padding and
  are now painted, and `fence`, `well` and `trunk`, which is the grass-strip change reaching a
  shipped sheet for the first time (the atlas had not been rebaked since 0.10). **That is the look
  change §12.2 item 9 asks an eye to confirm**, and it is now in the shipped art rather than only in
  the source.
- **The pre-bake atlas pin inverted, which is what it existed to do.** It went red on exactly its
  own assertion when run against the bake, and it now asserts the four ids present, appended and
  in ascending order (the lane pins the ordering; a gapped-but-ascending map would pass it).
  Both new arms were mutation-tested.
- **`manifest.json`** — nine lines: the version plus the sha256/bytes pairs for `client.js`, both
  sheets and `atlas.json`.
- **The `0.14.0` artifact zip**, at 1,185,575 bytes. The `0.13.0` zip is untouched. Three bakes over
  the same tree produced identical output and the same zip hash, so the artifact is reproducible.
- **The `?v=` cache key** every client asset URL carries moved with the version, which is what pairs
  the bump with the reshaped sheets so a returning player never gets a new atlas against a cached
  sheet.

The header stays so the next release's prep has a place to land.

## 13. The ladder moves — 0.15's play layer over 0.11's storage

Everything below reads state that has been in the block since 0.11 — `rel[zone][name]`
rows with `d` 0..3, `t`, `h`, `s`, the caps of §3 and the merge rules of §4.2. 0.15 adds
**no field and no byte to the wire**: it is the first release where `d` is written by play.

### 13.1 The promotion line

One table (`PROMOTION`, 58-player) and one rule. A rung is EARNED when the encounter
count crosses its line:

| rung | word         | earned at `t` |
|------|--------------|---------------|
| 1    | acquainted   | 3             |
| 2    | friendly     | 10            |
| 3    | close friend | 25            |

Encounters are weighted at the verb sites, not in the table, and each site also declares a
**verb class**:

| verb                  | site                       | weight | class          |
| --------------------- | -------------------------- | ------ | -------------- |
| an accepted talk turn | 90-element                 | 1      | **casual**     |
| a night's berth       | 59-economy `rentBerth()`   | 1      | **meaningful** |
| a rod bought          | 59-economy `buyRod()`      | 1      | **meaningful** |
| a finished job        | 61-pack `settle()`         | 3      | **meaningful** |

The classes are the maintainer's ruling of 0.15: saying good morning and asking after the
rumors should not, over enough mornings, make you somebody's best friend. Small interactions
raise standing only to a point; doing jobs, running quests, being business partners are what
carry it past acquaintance.

**CASUAL is the default.** It builds `t` forever and can never leave a row above
**acquainted** (`CASUAL_CEILING`, 58-player); past that ceiling its encounters accumulate and
nothing else happens. **MEANINGFUL** may cross any line. The class is a field of the CALL
(`patch.meaningful`), read in `bump()` and written to no row — the wire is 0.11's to the byte.

**The padding consequence, stated rather than discovered:** casual encounters DO count toward
the higher thresholds, so a hundred greetings leave a row that one job lifts straight to
friendly. What small talk cannot be is the press that CROSSES. Two consequences follow and
both are deliberate: one hand-in still makes a stranger acquainted, and the friend register
(§13.4) is **not reachable by talking at all** — a speaker serves friend lines only to a
player who has done business with them or finished their work. §12.3's four-bump
conversation is absorbed twice over: four sends in one window is four points, and four
casual points cannot leave anybody above acquainted whatever they add up to.

### 13.2 One rung a press, and a crossing rather than a max()

`bump()` promotes only when the patch carries **no explicit `d`**, and a single call moves the
row **at most one rung**. `row.d = earned` was a max() in disguise and it had a hole in it: a
row a demotion put on the floor at `t` 9 was handed TWO rungs by one good morning, because the
count was still high and there was still a line under it to cross.

The explicit arm stays the SETTER it has always been — that is S1's precise channel and the
harness pins it. What the heuristic promises a future demotion verb is **rate-limited
re-promotion, not none**, and the honest statement of it is three sentences. A casual press
still needs a real crossing, so a row demoted past every line is never re-fought on any
subsequent hello. A row demoted BELOW a line it can still cross IS lifted by the next
encounter — by one rung, and no further than acquainted unless the press is meaningful. A
meaningful press needs no crossing at all, because a row padded by talk is already past every
line it could cross, and freezing a player out of the ladder for having been friendly is not
the ruling. Nothing package-side demotes, and nothing writes `h` — hostility still waits for
S1.

`bump()` now returns `{ row, rose }` — `rose` is the rung earned by THIS call, else 0 — so a
caller with a receipt to print folds the rise into it rather than diffing for it. Refusal is
`null` exactly as §3 documents.

### 13.3 The reader

`rung(core, zoneId, name)` → `{ d, h }`, zeros for the unmet and for the wrong zone. It is
the one ladder read the window title, the promotion toast, the turn header and the pack's
register gate all share, and it is deliberately allocation-cheap: it runs inside a per-turn
composer and a window that rebuilds per press.

### 13.4 What reads the rung (the rest of the release)

- the pack's ask ladder serves the **friend register** at `d >= 2` (61-pack — Ruling 4's
  own terms: the promotion is now earned, so serving it is the ruling honoured, not overridden);
- the talk window titles the standing, and every press that earns a rung says so;
- the turn header's `near:` gains the rung word for anyone past stranger — one word, only
  when it says something.

**One sentence per event.** `hud.toast` is ONE node and ONE timer per surface, so two toasts
in a tick is exactly one toast: the second overwrites the first and the player never sees it.
A rise is therefore **composed into** the receipt it stands beside rather than said next to
it — `hud._said` joins the parts with a middot, `roseClause` is the rise in the pronoun form
for a receipt that already named the person, and `roseLine` stays the named standalone:

```
Handed in to Alder — 6 coins · they know you now.
Done for Bett Marsh — 5 coins · they count you a friend now.
A berth is yours — 12 coins the night. · Mira knows you now.
```

The rise rides each verb's own return (`settle()`, `turnIn()`, `rentBerth()`, `buyRod()` all
carry `rose`; the two counters carry `keeper` as well, because their receipts do not name
anybody), so it is said exactly when the rung was earned and never re-fires on a reload —
there is nothing stored to re-announce. An accepted talk turn hands its rise to the same
composer the errands go through, so a turn that also settles a delivery says both at once.

### 13.5 Deferred to the playtest (§12.3's list grows by two)

- **Do the lines feel earned at these speeds?** Acquainted-in-one-hand-in and
  friendly-around-day-ten are Stardew-shaped guesses (inspiration, not doctrine); the
  table is three numbers and one edit.
- **Does the friend voice read as a change of standing** — or does a friend-first ladder
  over a thin pack just serve the same two lines in a warmer register? The generation
  guidance widened for it; whether it is enough is a live-run question, the same one
  0.14 left open for the topic branches.
