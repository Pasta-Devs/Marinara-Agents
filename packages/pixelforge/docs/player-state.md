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

Companion documents: `brief-schema.md` (the world brief, which the block's stamps hash — and,
since 0.12, the feature register the fishing verb aims at) and `ROADMAP.md` (why S5 led 0.11, what
it gates, and what 0.12's rulings put on the list).

---

## 0. Where it lives

| concern                                                             | file                                        |
| ------------------------------------------------------------------- | ------------------------------------------- |
| the block, its serializer, its migrations, its mutators, its caps   | `src/58-player.js` (`PF.player`)            |
| the quarantine store                                                | `src/58-player.js` (`PF.quarantine`)        |
| the envelope, the two stores, the decision ladder, the loading gate | `src/60-save.js` (`PF.save`)                |
| item vocabulary, prices, the berth, the starting purse              | `src/59-economy.js` (`PF.economy`)          |
| the verbs and their tables: fishing, the rod ladder, sleep          | `src/59-economy.js` (same module — §7)      |
| the mint stamp the block compares against                           | `src/20-world.js` (`mintStampOf`, `MINT_V`) |
| the feature register the fishing verb aims at                       | `src/20-world.js` (`recordFeature`)         |
| the block's default-init on a fresh sim                             | `src/30-sim.js` (`new PF.Sim`)              |
| the clock movers, the wrap-up marker, the tell                      | `src/30-sim.js` (`advanceMinutes`, `stageLedgerOwed`, `_composeLedger`) |
| the journal panel and the character sheet                           | `src/70-hud.js` (`PF.Hud`)                  |
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
Recorded in §10.

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

The caps are **gameplay and hygiene bounds, not a size budget** (maintainer ruling; see §9). They do
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
that row deletes the block anyway (§10). Emitting the block conditionally to avoid the churn is the
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

**The residual the seam does not close** (§10): a degraded session that sent NO narration leaves the
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
between them, and sizes the pair against the keepalive quota (§9).

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
cost is accepted by choice (§10): a generation failure blocks play behind retry instead of degrading
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
paid for" are **one test and not two**. A homeless player has nowhere to sleep (a §10 never-flush
class, accepted), and a minted `{minted: true}` anchor names no zone to stand in, so it is not one
either. Walk-mode only, and refused while the host is streaming — not because of the pipeline, but
because the hours would pass under narration the player has not read yet.

**It sends nothing**, which is the whole shape of it: no turn, no narration, no await. The mover is
`waitUntil` (the rest action's jump), and what it leaves behind is a marker — see §8.

Every refusal is the **nothing-happened** shape that `fish` uses beside it: `reason` carries which
refusal it was and every number carries zero, because nothing moved. The reasons are distinct on
purpose and the numbers must not be, or a caller reading `day` would learn the kind of refusal by
accident and read a live clock off a call that spent no minutes.

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
back over them — so **Wait never stages**, which is one of the two never-flush classes in §10.

`ledgerOwed` is **world-unbound** and a severance does not touch it: the days it owes are days the
player lived, whatever world they lived them in. That is also what makes the restore-re-tell row in
§10 work.

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
leaves the tell in history un-burned and the next compose re-tells it, which is a §10 lost-flush
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
own action text. It is also **the only part of any turn a fishing word can reach the GM through**
(maintainer amendment): the verb narrates nothing and files ledger lines, and those lines are told
here or not at all. Note the honest scope of that claim: it is about **package-authored**
vocabulary. A brief a player wrote fishing into is theirs, and out of package control.

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

## 9. Sizes: measured, not budgeted

**There is no design budget** (maintainer ruling). The earlier hard "24 KB snapshot / 24 KB bag"
figures were inherited caution from a mobile-payload worry, and budget-driven caps are what make
settlements feel tiny. Sizes are **measured** — harness case (ah) prints them on every run — and
asserted only against the walls that are real:

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

### 9.1 What 0.12 added to the wire, measured

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

---

## 10. Accepted limitations

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
| the purchase is never forced and skippable indefinitely — but 0.12 ships **no income mechanic**, so a player who spends the whole starting purse before buying is priced out of fishing until income lands. No affordability coupling is asserted anywhere    | **maintainer override**; refusable, never broken |
| **sci-fi fishing is real fishing** with flavoured variants beside real fish; the well is not a fishing spot                                                                                                                                                 | **maintainer ruling**                           |
| the character sheet's portrait may render **Tier-0 art for a frame-class window** before assets are ready (self-heals through the value key), and beneath it is a themed generic label until the engine exposes a persona name and avatar                    | accepted; one enumerated Engine FR              |
| the fishing **trigger UX** and the **journal panel's shape** are ruled *provisionally* — conclusive at the 0.12 playtest                                                                                                                                    | named playtest-checklist items                  |

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
