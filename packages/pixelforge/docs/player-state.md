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

Companion documents: `brief-schema.md` (the world brief, which the block's stamps hash) and
`ROADMAP.md` (why S5 leads 0.11 and what it gates).

---

## 0. Where it lives

| concern                                                             | file                                        |
| ------------------------------------------------------------------- | ------------------------------------------- |
| the block, its serializer, its migrations, its mutators, its caps   | `src/58-player.js` (`PF.player`)            |
| the quarantine store                                                | `src/58-player.js` (`PF.quarantine`)        |
| the envelope, the two stores, the decision ladder, the loading gate | `src/60-save.js` (`PF.save`)                |
| item vocabulary, prices, the berth, the starting purse              | `src/59-economy.js` (`PF.economy`)          |
| the mint stamp the block compares against                           | `src/20-world.js` (`mintStampOf`, `MINT_V`) |
| the block's default-init on a fresh sim                             | `src/30-sim.js` (`new PF.Sim`)              |
| the transport                                                       | `src/00-prelude.js` (`PF.api`)              |
| every claim below, driven                                           | `test-brief.mjs` cases (q)–(ax)             |

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
  pouch: { money: 0, items: [ { t: "rod", q: 1, k: "fine" } ] },
  skills: {
    verbs: { fishing: { l: 1, x: 0 } },
    equipped: { fishing: { tool: ["rod", "fine"], mod: ["bait", "decent"] } },
  },
  quests_done_board: { "b:deliver-herb": 3 },

  // ── world-bound ───────────────────────────────────────────────────────────
  rel: { z1: { "Alder Vance": { d: 2, t: 9, h: 1, s: "…", a: 7 } } },
  quests: {
    done_pack: { "p:pk1:rat-cellar": 1 },
    active: [ { id, g: "z1|Alder Vance", verb, target, n, have, r: { money, xp }, day } ],
  },
  bought: null,                  // optional shop-depletion seam; absent until something is in it
  ledger: { lines: [ [37, "Fished at the Millpond until dusk."], [12, "Day 12: 4 things happened.", 4] ] },
  found: { zones: [ { p: "z4", e: 0, d: 3, day: 12, seen: true } ] },
  home: null,                    // a sealed anchor ("z3") or { minted: true } — never a bare h{n}
}
```

Short keys everywhere, no uuids, no derived values cached, no names stored except `rel` keys and
the `s` lines. `defaultPlayer()` (58-player) is the literal above with everything empty; its key
order **is** the wire order and the serializer reproduces it exactly.

### 1.1 Field classes

Every field declares one of three properties. This is not documentation of an intention — it is the
partition `applyStamps` and `transplant` actually implement, and a new field that does not declare
one will be silently treated as world-free by the first and dropped by the second.

| class           | fields                                                                                | what it means                                 | who acts on it                                            |
| --------------- | ------------------------------------------------------------------------------------- | --------------------------------------------- | --------------------------------------------------------- |
| **world-free**  | `pouch`, `skills`, `quests_done_board`, `game`, and a newer build's unknown keys      | means the same thing in any world             | crosses every seam untouched                              |
| **world-bound** | `rel`, `quests.active`, `quests.done_pack`, `found`, `home`, `ledger.lines`, `bought` | meaningless once the world changed under it   | quarantined whole on a brief change; never carried across |
| **coupled**     | `flushedDay`                                                                          | only interpretable against the lines it gates | quarantined _with_ the lines, and clamped when they go    |

`bought` is **world-bound**, and the reason is worth stating because its shape suggests otherwise:
it counts what a NAMED shop's stock has lost, and both the shop and its stock table are compiled
from the brief, so carried across a brief change it depletes a stranger's shelves.

`flushedDay`'s clamp is `min(flushedDay, minSeveredLineDay − 1)`, floored at 0, and it fires **only
when lines were actually severed** — an empty buffer must leave the gate exactly where it was, or a
save with nothing to lose still loses its day boundary. The same guard is re-applied on restoration
and on the transplant, because both put whole fields back by assignment and a restored line at or
below the gate would never be told (`log()` refuses any day the gate covers).

### 1.2 What the caps do, per cap

The caps are **gameplay and hygiene bounds, not a size budget** (maintainer ruling; see §8). They do
not all behave the same way, and a consumer has to know which calls can come back empty:

| behaviour                                          | caps                                                                                                                                                                                 | what the caller sees         |
| -------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------- |
| **evict** (the cap makes room, the call succeeds)  | `relLines` (evicts the oldest _line_, the row stands), `boardDone`/`packDone` (evict the least-earned counter), `ledgerDays`/`ledgerPerDay`/`ledgerStubs`, `found` (oldest by `day`) | success                      |
| **truncate** (the value is cut, the call succeeds) | `lineChars`, `ledgerChars`, `skillLevel` (the level stops climbing and xp is zeroed at the ceiling)                                                                                  | success                      |
| **refuse** (the call does nothing and says so)     | `items` (`grant()` → `0` on a new `(t,k)` row), `activeQuests` (`quest("accept")` → `false`), `relRows` (`bump()` → `null` when there is no stranger-tier row left to evict)         | the documented refusal value |

Current values (`CAPS`, 58-player): items 60, relRows 150, relLines 30, lineChars 80,
activeQuests 10, boardDone 40, packDone 40, bought 30, ledgerDays 3, ledgerPerDay 15,
ledgerStubs 30, ledgerChars 200, found 80, skillLevel 20.

Two eviction orders matter and are easy to conflate. The **row** cap prefers a STRANGER-tier row
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
that row deletes the block anyway (§9). Emitting the block conditionally to avoid the churn is the
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
5. **notices**, appended to the LIVE ledger.

A repair run before severance would drop quests the severance was about to quarantine intact; a
notice appended before severance would be severed along with the lines it is explaining. Notices
land at `max(sim.day, flushedDay + 1)` — a line at or below the gate is one the flush will skip, and
a notice nobody is ever told is worse than no notice.

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

**The residual the seam does not close** (§9): a degraded session that sent NO narration leaves the
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
between them, and sizes the pair against the keepalive quota (§8).

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
cost is accepted by choice (§9): a generation failure blocks play behind retry instead of degrading
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

## 7. The economy vocabulary

Everything in `59-economy.js` is content plus three game-facing entry points — `berthOffer` describes
and never charges, `rentBerth` and `grantStartingPurse` mutate. (The rest of the module — `_skin`,
`currency`, `money`, `describe`, `price` — is the vocabulary those three and the HUD read through.)
It holds **no state of its own**: what persists goes through the shipped mutators and lives in the
player block, which is what makes it rewind-safe.

### 7.1 Items, skins, prices

A pouch row is keyed `(t, k)` — type and quality. **`t` has to mean the same thing in every theme**
or a save crossing a theme change would be renaming the player's belongings, so the TYPES are shared
(`ITEM_TYPES`, currently `["lodging-key"]`) and only the **skin** — the display name, the glyph, and
what the world calls its money — is per theme.

| theme           | currency              | `lodging-key` | berth |
| --------------- | --------------------- | ------------- | ----- |
| `cozy-village`  | coin / coins, `◍`     | room key      | 12    |
| `sci-fi-colony` | credit / credits, `◈` | berth chit    | 12    |

`money(world, n)` renders `1 coin` / `12 coins` so a sci-fi colony never charges anybody "coins".
`describe(world, item)` renders an UNKNOWN type as its own tag with hyphens AND underscores turned
into spaces, still carrying the quality prefix — `{t:"warp_core",k:"fine"}` reads "fine warp core" —
rather than letting it vanish from the purse, so a newer build's item, or one a GM channel grants
later, still reads. A row with no usable `t` at all is the one case that renders as `""`.
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
naming a theme this build dropped, not as a licence to ship a live theme unnamed.

The fixed price lists are a first step. The plan's weekly deterministic stock tables need L2's
calendar and arrive with it; a table lookup replaces the constant and the verbs do not move.

### 7.2 The berth: the contract

`berthOffer(core)` **describes only** — it never charges anything, so the HUD can call it every frame
and a caller can render the refusal instead of hiding the button. It returns
`{ available, reason, keeper, zoneId, price, home }` with `reason` one of `no-keeper`, `no-lodging`,
`not-for-sale`, `no-player`, `already-yours`, `cannot-afford`. **The offer follows the PERSON, not the
room**: `npc.lodging` is stamped on the keeper of the settlement's gathering, so an innkeeper standing
in the square at noon can still let you a room, which is what a keeper is. Renting the same berth
twice is refused rather than sold again — that is not a second room, it is the same room and a
lighter purse.

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

---

## 8. Sizes: measured, not budgeted

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

**On write amplification**, since it will come up: "rewrite only changed chunks" is not
package-controllable. Each anchor row is a _full_ snapshot by design — that completeness is what makes
rewind work — and the engine's file-backed store re-serializes the chat's whole `game_engine_state`
shard on any write. Delta rows or chunked shard writes would be an engine storage change. Package-side
the levers are the ones already pulled: small blocks, short keys, caps, and prose held to the capped
`s` lines.

---

## 9. Accepted limitations

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

Two of these name Engine FRs — **#5406** (authoritative write ordering) and **#5407** (`rawState`
on parse failure). Both are **merged to Engine `staging`** but not yet in a tagged release, and
this package's `builtAgainst` 2.4.3 predates them; §5.2 and §5.4 describe the client readers that
are already in place and dormant until an Engine release carries the fields.
