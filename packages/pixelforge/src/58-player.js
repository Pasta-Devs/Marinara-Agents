// ── The player state block (S5) ───────────────────────────────────────────────
// One namespaced, versioned `player` block inside the save snapshot: inventory
// and money, skills and equipped tools, the relationship ledger, quest state,
// the day-ledger buffer, discovery state, and the home anchor. Everything else
// in the world stays a pure function of (seed, theme, brief, clock) — that is
// what keeps a rebuild byte-identical and a rewind safe.
//
// THREE PROPERTIES, declared per field (plan §0):
//   • world-free  — means the same thing in any world (pouch, skills, board-done)
//   • world-bound — meaningless once the world changed under it (rel, quests,
//                   found, home, ledger lines)
//   • coupled     — `flushedDay`, which is only interpretable against the lines
//                   it gates, so it is quarantined WITH them and clamped when
//                   they go (plan §0, §Q3a)
//
// The block carries its OWN version (`player.v`), not the envelope's: an
// envelope bump would force a player migration that changes nothing, and a
// player bump would invalidate envelopes that were fine (ROADMAP §S5).

// The player block's schema version is DERIVED from the migration table, never
// written twice: `MIGRATIONS[i]` takes v(i+1) to v(i+2), so an empty table is
// exactly "v1, and v1 is the identity". A step and a version constant that can
// disagree is a bug waiting for its first migration.
const PLAYER_MIGRATIONS = [];
const currentPlayerV = () => PLAYER_MIGRATIONS.length + 1;

// Size caps (plan §4). Every one of them is an EVICTION, never a refusal: a
// mutator that silently did nothing would strand a consumer in slice 6 waiting
// for state that never arrives.
const CAPS = {
  items: 60, // pouch rows, keyed (t,k)
  relRows: 150, // relationship rows per SAVE, across zones
  relLines: 30, // rows allowed to hold an `s` line at once
  lineChars: 80, // graphemes in one `s` line
  activeQuests: 10,
  boardDone: 40,
  packDone: 40,
  bought: 30,
  ledgerDays: 3, // days kept in FULL
  ledgerPerDay: 15,
  ledgerStubs: 30, // elided days, one stub line each
  ledgerChars: 200,
  found: 80,
  skillLevel: 20,
};

// Placeholder curve, exported so slice 6 can retune it without touching the
// mutator: experience needed to leave level `l`.
const xpPerLevel = (l) => 10 * Math.max(1, l);

// The quarantine bag's own ceiling, independent of the snapshot's (plan §4).
// It lives in its own metadata key, so it competes with nothing.
const QUARANTINE_MAX_CHARS = 24_576;
// Least-recoverable first (plan §Q1a). `setAside` goes before anything else:
// nothing else in the bag is waiting on a machine to hand it back.
const QUARANTINE_DROP_ORDER = ["setAside", "stamp", "migration", "version"];
const QUARANTINE_SLOTS = ["migration", "stamp", "setAside", "version"];
const QUARANTINE_KEY = "pixelforgeQuarantine";

const isFiniteInt = (v) => typeof v === "number" && Number.isFinite(v) && Math.floor(v) === v;
const posInt = (v, fallback) => (isFiniteInt(v) && v >= 0 ? v : fallback);
const str = (v) => (typeof v === "string" ? v : "");
// JSON.parse hands "__proto__" back as an own property; assigning it onto a
// plain object sets the PROTOTYPE instead of a key. Every map read below goes
// through this (the same discipline 60-save's binding read already uses).
const ownEntries = (obj) => {
  if (!obj || typeof obj !== "object" || Array.isArray(obj)) return [];
  const out = [];
  for (const key of Object.keys(obj)) {
    if (key === "__proto__") continue;
    out.push([key, obj[key]]);
  }
  return out;
};
// Sorted-key rebuild. JS enumerates integer-like keys first whatever the
// insertion order, so this is deterministic rather than literally sorted for
// such a key — determinism is the property the dedupe needs, not the ordering.
const sortedMap = (pairs) => {
  const out = {};
  for (const [key, value] of pairs.slice().sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))) {
    if (value !== undefined) out[key] = value;
  }
  return out;
};

/** Grapheme-aware truncation: an `s` line is player-visible prose and a cut
 *  through a surrogate pair or a combining mark renders as a broken glyph. */
const clip = (text, max) => {
  const s = str(text).replace(/\s+/g, " ").trim();
  let units;
  try {
    units = globalThis.Intl?.Segmenter
      ? Array.from(new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(s), (part) => part.segment)
      : Array.from(s);
  } catch {
    units = Array.from(s);
  }
  return units.length <= max ? s : units.slice(0, max).join("");
};

PF.player = {
  CAPS,
  MIGRATIONS: PLAYER_MIGRATIONS,
  xpPerLevel,
  /** The schema version THIS build writes. Derived — see PLAYER_MIGRATIONS. */
  currentV: currentPlayerV,

  /** A brand-new block. The key order here is the wire order (plan §2) and the
   *  serializer reproduces it exactly; `bought` boots ABSENT (it is an optional
   *  seam that activates with the stock-table model) and is only emitted once
   *  something is in it. */
  defaultPlayer() {
    return {
      v: currentPlayerV(),
      game: 1,
      world: { seed: 0, briefHash: 0, mintStamp: 0 },
      flushedDay: 0,
      pouch: { money: 0, items: [] },
      skills: { verbs: {}, equipped: {} },
      quests_done_board: {},
      rel: {},
      quests: { done_pack: {}, active: [] },
      bought: null,
      ledger: { lines: [] },
      found: { zones: [] },
      home: null,
    };
  },

  // ── World identity (plan §Q3, §Q3a) ────────────────────────────────────────

  /** FNV over the SEALED brief, which is the artifact the world was compiled
   *  from. Absent brief → 0, which is also what a legacy world stamps, so the
   *  two are deliberately indistinguishable: neither has a brief to change. */
  briefHashOf(brief) {
    if (!brief || typeof brief !== "object") return 0;
    try {
      return PF.hashStr(JSON.stringify(brief));
    } catch {
      return 0;
    }
  },

  /** The three stamps a world answers for. `mintStamp` is derived by the
   *  compiler (20-world `mintStampOf`) and costs zero save bytes. */
  stampsFor(world, brief) {
    return {
      seed: (world?.seed ?? 0) >>> 0,
      briefHash: this.briefHashOf(brief),
      mintStamp: (world?.mintStamp ?? 0) >>> 0,
    };
  },

  // ── Serialization (plan §2) ────────────────────────────────────────────────

  /** By value, deterministic, byte-stable under JSON.stringify. Every dedupe in
   *  the save path is string equality over the serialized snapshot, so an order
   *  that drifted with the source would forge both spurious saves and spurious
   *  "The world rewound with the story." toasts (60-save snapshot()). */
  serialize(player) {
    const p = player && typeof player === "object" ? player : this.defaultPlayer();
    const out = {};
    out.v = posInt(p.v, currentPlayerV());
    out.game = Math.max(1, posInt(p.game, 1));
    out.world = {
      seed: posInt(p.world?.seed, 0) >>> 0,
      briefHash: posInt(p.world?.briefHash, 0) >>> 0,
      mintStamp: posInt(p.world?.mintStamp, 0) >>> 0,
    };
    out.flushedDay = posInt(p.flushedDay, 0);
    out.pouch = {
      money: posInt(p.pouch?.money, 0),
      // Sorted by (t,k): the bag is a SET keyed that way, so insertion order is
      // an accident of play and would make two identical inventories serialize
      // to different bytes.
      items: (Array.isArray(p.pouch?.items) ? p.pouch.items : [])
        .filter((it) => it && typeof it === "object" && str(it.t))
        .map((it) => ({ t: str(it.t), q: posInt(it.q, 0), k: str(it.k) }))
        .sort((a, b) => (a.t === b.t ? (a.k < b.k ? -1 : a.k > b.k ? 1 : 0) : a.t < b.t ? -1 : 1)),
    };
    out.skills = {
      verbs: sortedMap(
        ownEntries(p.skills?.verbs).map(([verb, row]) => [
          verb,
          { l: Math.max(1, posInt(row?.l, 1)), x: posInt(row?.x, 0) },
        ]),
      ),
      equipped: sortedMap(
        ownEntries(p.skills?.equipped).map(([verb, slots]) => [
          verb,
          sortedMap(
            ownEntries(slots)
              .filter(([, pair]) => Array.isArray(pair) && str(pair[0]))
              .map(([slot, pair]) => [slot, [str(pair[0]), str(pair[1])]]),
          ),
        ]),
      ),
    };
    out.quests_done_board = sortedMap(ownEntries(p.quests_done_board).map(([id, n]) => [id, posInt(n, 0)]));
    out.rel = sortedMap(
      ownEntries(p.rel).map(([zoneId, rows]) => [
        zoneId,
        sortedMap(
          ownEntries(rows).map(([name, row]) => {
            const cell = { d: PF.clamp(posInt(row?.d, 0), 0, 3), t: posInt(row?.t, 0) };
            // `h` and `s` are emitted ONLY when set: a hostile flag on every row
            // and an empty string on every row would be pure size for nothing.
            if (row?.h) cell.h = 1;
            const line = clip(row?.s, CAPS.lineChars);
            if (line) cell.s = line;
            return [name, cell];
          }),
        ),
      ]),
    );
    out.quests = {
      done_pack: sortedMap(ownEntries(p.quests?.done_pack).map(([id, n]) => [id, posInt(n, 0)])),
      active: (Array.isArray(p.quests?.active) ? p.quests.active : [])
        .filter((q) => q && typeof q === "object" && str(q.id))
        .map((q) => ({
          id: str(q.id),
          g: str(q.g),
          verb: str(q.verb),
          target: str(q.target),
          n: posInt(q.n, 0),
          have: posInt(q.have, 0),
          r: { money: posInt(q.r?.money, 0), xp: posInt(q.r?.xp, 0) },
          day: posInt(q.day, 0),
        }))
        .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)),
    };
    // The optional shop-depletion seam. Absent unless something bought
    // something — an empty object every save would be four bytes of nothing.
    const bought = sortedMap(
      ownEntries(p.bought).map(([shop, rows]) => [
        shop,
        sortedMap(ownEntries(rows).map(([t, n]) => [t, posInt(n, 0)])),
      ]),
    );
    if (Object.keys(bought).length) out.bought = bought;
    out.ledger = {
      // CHRONOLOGICAL, never sorted: the buffer is a transcript and its order is
      // its meaning. A JSON round-trip preserves array order, so it is stable.
      lines: (Array.isArray(p.ledger?.lines) ? p.ledger.lines : [])
        .filter((line) => Array.isArray(line) && line.length >= 2)
        .map((line) => [posInt(line[0], 0), clip(line[1], CAPS.ledgerChars)]),
    };
    out.found = {
      zones: (Array.isArray(p.found?.zones) ? p.found.zones : [])
        .filter((z) => z && typeof z === "object" && str(z.p))
        .map((z) => ({
          p: str(z.p),
          e: posInt(z.e, 0),
          d: posInt(z.d, 0),
          day: posInt(z.day, 0),
          seen: z.seen === true,
        }))
        .sort((a, b) => {
          const ka = `${a.p}|${a.e}|${a.d}`;
          const kb = `${b.p}|${b.e}|${b.d}`;
          return ka < kb ? -1 : ka > kb ? 1 : 0;
        }),
    };
    // A sealed anchor ("z3") or { minted: true } — never a bare h{n} (§2).
    out.home =
      typeof p.home === "string" && p.home ? p.home : p.home && p.home.minted === true ? { minted: true } : null;
    return out;
  },

  // ── Parse / migrate (plan §Q1) ─────────────────────────────────────────────

  /** Read a saved `player` block. NEVER throws: every failure boots defaults and
   *  says why, because a save path that can brick the surface is worse than one
   *  that loses a block. Returns
   *    { player, source, quarantine: null | { slot, entry } }
   *  where `source` is "saved" | "defaults" and the caller owns the bag write. */
  parse(raw) {
    const fresh = () => this.defaultPlayer();
    if (raw === undefined || raw === null) return { player: fresh(), source: "defaults", quarantine: null };
    if (typeof raw !== "object" || Array.isArray(raw)) {
      // Not even the right kind of thing. There is no corrupt slot (plan §Q1a:
      // unimplementable client-side), and a scalar carries nothing to recover.
      return { player: fresh(), source: "defaults", quarantine: null };
    }
    const v = raw.v;
    if (!isFiniteInt(v) || v < 1) {
      // A block that will not declare its version cannot be migrated and cannot
      // be trusted. Parked in `migration` rather than dropped: a later build
      // whose reader is looser is exactly the thing that could still read it.
      return {
        player: fresh(),
        source: "defaults",
        quarantine: { slot: "migration", entry: { reason: "shape", fromV: null, block: raw } },
      };
    }
    const current = currentPlayerV();
    if (v > current) {
      // TOO NEW. Never parsed, never overwritten — quarantined VERBATIM so the
      // build that wrote it can take it back (plan §Q1). `adoptable` is written
      // at creation and is what a later build looks for.
      return {
        player: fresh(),
        source: "defaults",
        quarantine: { slot: "version", entry: { reason: "too-new", fromV: v, adoptable: true, block: raw } },
      };
    }
    let block = raw;
    try {
      for (let step = v; step < current; step++) block = PLAYER_MIGRATIONS[step - 1](block);
    } catch (err) {
      // A THROWING step keeps its input, not its half-migrated output: the
      // input is the thing a fixed step will be run against.
      return {
        player: fresh(),
        source: "defaults",
        quarantine: {
          slot: "migration",
          entry: {
            reason: "throw",
            fromV: v,
            message: err && err.message ? String(err.message) : String(err),
            block: raw,
          },
        },
      };
    }
    if (!block || typeof block !== "object" || Array.isArray(block)) {
      return {
        player: fresh(),
        source: "defaults",
        quarantine: { slot: "migration", entry: { reason: "shape", fromV: v, block: raw } },
      };
    }
    // Shape-validate by NORMALIZING: serialize() already coerces every field to
    // its declared shape and drops what will not coerce, so one pass through it
    // is the validator AND guarantees the parsed block round-trips byte-stably.
    const player = this.serialize(block);
    player.v = current;
    // serialize() omits an empty `bought`; the live block wants the null seam
    // back so a mutator has somewhere to write.
    if (player.bought === undefined) player.bought = null;
    return { player, source: "saved", quarantine: null };
  },

  // ── Stamps, severance, restoration (plan §Q3a) ─────────────────────────────

  /** Are the stamps comparable at all? Never against an absent-or-EXPECTED
   *  brief: an interim world is a throwaway the sealed brief will replace, and
   *  severing against it would quarantine a save for a world that never was. */
  stampsEvaluable(world, brief, briefExpected) {
    if (!world || world.interim) return false;
    if (!brief && briefExpected) return false;
    return true;
  },

  /** Compare, sever, and hand back what to quarantine. Mutates `player` in
   *  place (it is the freshly-parsed block, not yet anybody's live state).
   *  Returns { severed: null | { slot:"stamp", entry }, notices: string[] }. */
  applyStamps(player, world, brief, briefExpected) {
    const now = this.stampsFor(world, brief);
    const notices = [];
    if (!this.stampsEvaluable(world, brief, briefExpected)) return { severed: null, notices, evaluated: false };
    const was = player.world;
    // A block with no stamps of its own (a pre-S5 save, or a fresh default) has
    // nothing to disagree with: stamp it and move on.
    const unstamped = !was || (!was.seed && !was.briefHash && !was.mintStamp);
    if (unstamped) {
      player.world = { ...now };
      return { severed: null, notices, evaluated: true };
    }
    const briefMoved = was.briefHash !== now.briefHash || was.seed !== now.seed;
    const mintMoved = was.mintStamp !== now.mintStamp;
    if (!briefMoved && !mintMoved) {
      player.world = { ...now };
      return { severed: null, notices, evaluated: true };
    }
    const entry = {
      reason: briefMoved ? "brief" : "mint",
      fromV: player.v,
      stamps: { ...was },
      fields: {},
    };
    if (briefMoved) {
      // EVERY world-bound field goes. The world this save was played in is not
      // the world about to be compiled, and a relationship row, a quest, a
      // discovery or a ledger line means nothing across that line.
      entry.fields.rel = player.rel;
      entry.fields.questsActive = player.quests.active;
      entry.fields.questsDonePack = player.quests.done_pack;
      entry.fields.found = player.found.zones;
      entry.fields.home = player.home;
      entry.fields.ledgerLines = player.ledger.lines;
      entry.fields.flushedDayWas = player.flushedDay;
      player.rel = {};
      player.quests = { done_pack: {}, active: [] };
      player.found = { zones: [] };
      player.home = null;
      const lines = player.ledger.lines;
      player.ledger = { lines: [] };
      // COUPLED, and only when lines were ACTUALLY severed (plan §0): an empty
      // buffer must leave the gate exactly where it was, or a save with nothing
      // to lose still loses its day boundary.
      if (lines.length) {
        const minDay = lines.reduce((low, line) => Math.min(low, posInt(line[0], 0)), Infinity);
        player.flushedDay = Math.max(0, Math.min(posInt(player.flushedDay, 0), minDay - 1));
      }
      entry.fields.flushedDay = player.flushedDay;
      notices.push("Some of what you had done here belonged to another world. It has been set aside.");
    } else {
      // MINT-ONLY: the brief is the same, so everybody the brief NAMED is the
      // same person and their rows are safe. Everybody else was MINTED, and the
      // mint just changed under them.
      //
      // The test is the COMPLEMENT of the brief's named cast, not membership of
      // the new world's `minted` list, and the difference is the whole point: a
      // resident the OLD mint produced and the new one does not is exactly the
      // row that has to go, and she is in neither list. The `minted` list only
      // stands in when there is no brief to name anybody — a legacy world, whose
      // mint is empty and whose stamp moves only when MINT_V does.
      const named = new Set(
        brief && Array.isArray(brief.cast) ? brief.cast.map((member) => str(member?.name)).filter(Boolean) : null,
      );
      const isMinted = (name) =>
        brief && Array.isArray(brief.cast)
          ? !named.has(name)
          : (Array.isArray(world.minted) ? world.minted : []).includes(name);
      const minted = { has: isMinted };
      const severedRel = {};
      let touched = false;
      for (const [zoneId, rows] of ownEntries(player.rel)) {
        const keep = {};
        const gone = {};
        for (const [name, row] of ownEntries(rows)) {
          if (minted.has(name)) gone[name] = row;
          else keep[name] = row;
        }
        if (Object.keys(gone).length) {
          severedRel[zoneId] = gone;
          touched = true;
        }
        if (Object.keys(keep).length) player.rel[zoneId] = keep;
        else delete player.rel[zoneId];
      }
      const giverName = (g) => {
        const text = str(g);
        const bar = text.indexOf("|");
        return bar >= 0 ? text.slice(bar + 1) : text;
      };
      const severedQuests = player.quests.active.filter((q) => minted.has(giverName(q.g)));
      if (severedQuests.length) {
        player.quests.active = player.quests.active.filter((q) => !minted.has(giverName(q.g)));
        touched = true;
      }
      if (!touched) {
        // The mint moved but nothing of the player's hung off it. Re-stamp and
        // quarantine nothing — an empty entry would only cost a slot.
        player.world = { ...now };
        return { severed: null, notices, evaluated: true };
      }
      entry.fields.rel = severedRel;
      entry.fields.questsActive = severedQuests;
      notices.push("Some of the people you knew here are not the people who live here now.");
    }
    player.world = { ...now };
    return { severed: { slot: "stamp", entry }, notices, evaluated: true };
  },

  /** The other direction: a stamp slot whose stamps match the world we just
   *  built is a save coming HOME. Restoration DISCARDS whatever world-bound
   *  fields were written during the quarantine window (plan §Q3a) — the point
   *  of the window is that everything in it belonged to the wrong world. */
  restoreStamped(player, entry, world, brief) {
    if (!entry || typeof entry !== "object") return false;
    const now = this.stampsFor(world, brief);
    const was = entry.stamps || {};
    if (was.seed !== now.seed || was.briefHash !== now.briefHash || was.mintStamp !== now.mintStamp) return false;
    const fields = entry.fields || {};
    if (entry.reason === "mint") {
      for (const [zoneId, rows] of ownEntries(fields.rel)) {
        const target = ownEntries(player.rel[zoneId]).length ? player.rel[zoneId] : {};
        for (const [name, row] of ownEntries(rows)) target[name] = row;
        player.rel[zoneId] = target;
      }
      if (Array.isArray(fields.questsActive)) player.quests.active = [...player.quests.active, ...fields.questsActive];
    } else {
      if (fields.rel !== undefined) player.rel = fields.rel && typeof fields.rel === "object" ? fields.rel : {};
      if (Array.isArray(fields.questsActive)) player.quests.active = fields.questsActive;
      if (fields.questsDonePack !== undefined)
        player.quests.done_pack =
          fields.questsDonePack && typeof fields.questsDonePack === "object" ? fields.questsDonePack : {};
      if (Array.isArray(fields.found)) player.found = { zones: fields.found };
      if (fields.home !== undefined) player.home = fields.home;
      if (Array.isArray(fields.ledgerLines)) player.ledger = { lines: fields.ledgerLines };
      if (fields.flushedDay !== undefined) player.flushedDay = posInt(fields.flushedDay, player.flushedDay);
    }
    // THE GUARD, re-applied rather than trusted. A restored line at or below the
    // gate would never be told: the flush skips everything the gate covers.
    const lines = Array.isArray(player.ledger?.lines) ? player.ledger.lines : [];
    if (lines.length) {
      const minDay = lines.reduce((low, line) => Math.min(low, posInt(line[0], 0)), Infinity);
      player.flushedDay = Math.max(0, Math.min(posInt(player.flushedDay, 0), minDay - 1));
    }
    // Normalize back through the serializer: the entry came off the wire and its
    // rows have to satisfy the same shape contract everything else does.
    const normalized = this.serialize(player);
    normalized.v = player.v;
    if (normalized.bought === undefined) normalized.bought = null;
    return normalized;
  },

  // ── Quest-dangling repair (plan §Q5) ───────────────────────────────────────

  /** Drop active quests whose giver is not in this world. GATED, because the
   *  three ways to be wrong all look the same from here: an interim world has
   *  not been compiled yet, an unevaluated stamp means we do not know whether
   *  this is even the right world, and EVERY giver dangling says the world is
   *  wrong rather than the quests. Returns { dropped, notices }. */
  repairQuests(player, world, evaluated) {
    const notices = [];
    const active = Array.isArray(player.quests?.active) ? player.quests.active : [];
    if (!active.length || !world || world.interim || !evaluated) return { dropped: [], notices };
    const known = new Set();
    for (const zoneId of Object.keys(world.zones ?? {})) {
      for (const npc of world.zones[zoneId].npcs ?? []) if (npc && npc.name) known.add(npc.name);
    }
    if (!known.size) return { dropped: [], notices };
    const giverName = (g) => {
      const text = str(g);
      const bar = text.indexOf("|");
      return bar >= 0 ? text.slice(bar + 1) : text;
    };
    const dangling = active.filter((q) => !known.has(giverName(q.g)));
    if (!dangling.length) return { dropped: [], notices };
    if (dangling.length === active.length) {
      // ALL of them. That is a statement about the world, not the quests.
      return { dropped: [], notices };
    }
    player.quests.active = active.filter((q) => known.has(giverName(q.g)));
    notices.push("A task you had taken on has no one left to hand it back to.");
    return { dropped: dangling, notices };
  },

  // ── The brief-arrival transplant (plan §Q5, one release of compat) ─────────

  /** A chat created BEFORE the loading gate boots on a throwaway world and
   *  rebuilds when its generated brief seals. World-free fields cross; every
   *  world-bound field goes to the stamp slot with the stamps it belonged to;
   *  the block is re-stamped for the world that just arrived.
   *  Returns { player, severed }. */
  transplant(oldPlayer, world, brief) {
    const source = oldPlayer && typeof oldPlayer === "object" ? oldPlayer : this.defaultPlayer();
    const next = this.defaultPlayer();
    next.game = Math.max(1, posInt(source.game, 1));
    next.pouch = source.pouch ?? next.pouch;
    next.skills = source.skills ?? next.skills;
    next.quests_done_board = source.quests_done_board ?? next.quests_done_board;
    next.bought = source.bought ?? null;
    const wasStamps =
      source.world && typeof source.world === "object" ? { ...source.world } : { seed: 0, briefHash: 0, mintStamp: 0 };
    const lines = Array.isArray(source.ledger?.lines) ? source.ledger.lines : [];
    let flushedDay = posInt(source.flushedDay, 0);
    if (lines.length) {
      const minDay = lines.reduce((low, line) => Math.min(low, posInt(line[0], 0)), Infinity);
      flushedDay = Math.max(0, Math.min(flushedDay, minDay - 1));
    }
    next.flushedDay = flushedDay;
    const hadWorldBound =
      ownEntries(source.rel).length ||
      (Array.isArray(source.quests?.active) && source.quests.active.length) ||
      ownEntries(source.quests?.done_pack).length ||
      (Array.isArray(source.found?.zones) && source.found.zones.length) ||
      source.home != null ||
      lines.length;
    const severed = hadWorldBound
      ? {
          slot: "stamp",
          entry: {
            reason: "brief",
            fromV: posInt(source.v, currentPlayerV()),
            stamps: wasStamps,
            fields: {
              rel: source.rel ?? {},
              questsActive: source.quests?.active ?? [],
              questsDonePack: source.quests?.done_pack ?? {},
              found: source.found?.zones ?? [],
              home: source.home ?? null,
              ledgerLines: lines,
              flushedDayWas: posInt(source.flushedDay, 0),
              flushedDay,
            },
          },
        }
      : null;
    next.world = this.stampsFor(world, brief);
    const normalized = this.serialize(next);
    normalized.v = currentPlayerV();
    if (normalized.bought === undefined) normalized.bought = null;
    return { player: normalized, severed };
  },

  // ── Mutation API (plan §3) ─────────────────────────────────────────────────
  // Every mutator RE-RESOLVES core.sim (never a captured sim — a chat switch
  // reassigns it under any caller holding one), is generation-FENCED on the
  // optional trailing `gen`, and is SELF-DIRTYING: markDirty lives inside the
  // mutator so a consumer cannot forget it. Consumers land in slice 6.

  /** The live block, minted on demand. Returns null when the fence says this
   *  call belongs to a chat we already left. */
  _live(core, gen) {
    if (!core || typeof core !== "object") return null;
    if (gen !== undefined && gen !== (PF.save?._gen ?? 0)) return null;
    const sim = core.sim;
    if (!sim) return null;
    if (!sim.player || typeof sim.player !== "object" || Array.isArray(sim.player)) sim.player = this.defaultPlayer();
    return sim.player;
  },

  /** Read-only accessor for consumers that only want to render. */
  get(core) {
    return core && core.sim && core.sim.player ? core.sim.player : null;
  },

  _touch(core) {
    if (core.sim) core.sim.dirty = true;
    PF.save?.markDirty?.(core);
  },

  _itemKey(item) {
    if (typeof item === "string") return { t: item, k: "" };
    return { t: str(item?.t), k: str(item?.k) };
  },

  /** Add to the pouch. Merges by (t,k) — the bag has no uuids by design. */
  grant(core, item, qty, gen) {
    const p = this._live(core, gen);
    if (!p) return 0;
    const { t, k } = this._itemKey(item);
    if (!t) return 0;
    const n = Math.max(1, posInt(qty, 1));
    let row = p.pouch.items.find((it) => it.t === t && str(it.k) === k);
    if (!row) {
      if (p.pouch.items.length >= CAPS.items) return 0;
      row = { t, q: 0, k };
      p.pouch.items.push(row);
    }
    row.q = posInt(row.q, 0) + n;
    this._touch(core);
    return row.q;
  },

  /** Remove from the pouch. All-or-nothing: a partial take would leave a
   *  consumer believing it paid a price it only half paid. */
  take(core, item, qty, gen) {
    const p = this._live(core, gen);
    if (!p) return false;
    const { t, k } = this._itemKey(item);
    const n = Math.max(1, posInt(qty, 1));
    const index = p.pouch.items.findIndex((it) => it.t === t && str(it.k) === k);
    if (index < 0 || posInt(p.pouch.items[index].q, 0) < n) return false;
    const row = p.pouch.items[index];
    row.q -= n;
    if (row.q <= 0) p.pouch.items.splice(index, 1);
    this._touch(core);
    return true;
  },

  /** Apply a reward: money and/or experience in one verb. Money floors at zero
   *  — a negative purse is a bug that would then price everything wrong. */
  award(core, reward, gen) {
    const p = this._live(core, gen);
    if (!p) return null;
    const money = isFiniteInt(reward?.money) ? reward.money : 0;
    const xp = Math.max(0, posInt(reward?.xp, 0));
    const verb = str(reward?.verb);
    if (money) p.pouch.money = Math.max(0, posInt(p.pouch.money, 0) + money);
    let row = null;
    if (xp && verb) {
      row = p.skills.verbs[verb];
      if (!row || typeof row !== "object") {
        row = { l: 1, x: 0 };
        p.skills.verbs[verb] = row;
      }
      row.x = posInt(row.x, 0) + xp;
      while (row.l < CAPS.skillLevel && row.x >= xpPerLevel(row.l)) {
        row.x -= xpPerLevel(row.l);
        row.l += 1;
      }
      if (row.l >= CAPS.skillLevel) row.x = 0;
    }
    this._touch(core);
    return { money: p.pouch.money, level: row ? row.l : null };
  },

  /** Bind a tool or a modifier to a verb. `item` null clears the slot. Slots are
   *  a CLOSED vocabulary so the block cannot grow a new dimension by accident. */
  equip(core, verb, slot, item, gen) {
    const p = this._live(core, gen);
    if (!p) return false;
    const name = str(verb);
    if (!name || (slot !== "tool" && slot !== "mod")) return false;
    let slots = p.skills.equipped[name];
    if (!slots || typeof slots !== "object") {
      slots = {};
      p.skills.equipped[name] = slots;
    }
    if (item == null) delete slots[slot];
    else {
      const { t, k } = this._itemKey(item);
      if (!t) return false;
      slots[slot] = [t, k];
    }
    if (!Object.keys(slots).length) delete p.skills.equipped[name];
    this._touch(core);
    return true;
  },

  /** Move a relationship. `patch` is { d, t, h, s }: d is the 0-3 ladder, t
   *  counts encounters, h flags hostility, s is the last line worth remembering.
   *  Two caps bite here and they bite DIFFERENTLY (plan §4): the row cap evicts
   *  whole STRANGER rows, and the line cap evicts the oldest LINE and leaves the
   *  row standing. */
  bump(core, zoneId, name, patch, gen) {
    const p = this._live(core, gen);
    if (!p) return null;
    const zone = str(zoneId);
    const who = str(name);
    if (!zone || !who || who === "__proto__") return null;
    let rows = p.rel[zone];
    if (!rows || typeof rows !== "object") {
      rows = {};
      p.rel[zone] = rows;
    }
    let row = rows[who];
    const isNew = !row || typeof row !== "object";
    if (isNew) {
      if (this._relRowCount(p) >= CAPS.relRows && !this._evictStranger(p)) return null;
      row = { d: 0, t: 0 };
      rows[who] = row;
    }
    if (patch && typeof patch === "object") {
      if (patch.d !== undefined) row.d = PF.clamp(posInt(patch.d, 0), 0, 3);
      row.t = posInt(row.t, 0) + Math.max(0, posInt(patch.t, patch.t === undefined ? 1 : 0));
      if (patch.h !== undefined) {
        if (patch.h) row.h = 1;
        else delete row.h;
      }
      if (patch.s !== undefined) {
        const line = clip(patch.s, CAPS.lineChars);
        if (line) {
          row.s = line;
          row._sAt = this._lineSeq = (this._lineSeq ?? 0) + 1;
          this._evictLines(p);
        } else delete row.s;
      }
    } else {
      row.t = posInt(row.t, 0) + 1;
    }
    this._touch(core);
    return row;
  },

  _relRowCount(p) {
    let n = 0;
    for (const [, rows] of ownEntries(p.rel)) n += ownEntries(rows).length;
    return n;
  },

  /** Evict one STRANGER-tier row (d === 0, fewest encounters, no line). A row
   *  the player has actually built something with is never the one that goes. */
  _evictStranger(p) {
    let worst = null;
    for (const [zoneId, rows] of ownEntries(p.rel)) {
      for (const [name, row] of ownEntries(rows)) {
        if (posInt(row?.d, 0) !== 0 || row?.s) continue;
        if (!worst || posInt(row?.t, 0) < worst.t) worst = { zoneId, name, t: posInt(row?.t, 0) };
      }
    }
    if (!worst) return false;
    delete p.rel[worst.zoneId][worst.name];
    if (!ownEntries(p.rel[worst.zoneId]).length) delete p.rel[worst.zoneId];
    return true;
  },

  /** The LINE cap, which is not the row cap: past thirty lines the OLDEST line
   *  is dropped and its row stays exactly where it was, with its ladder and its
   *  encounter count intact. Losing the row instead would lose the relationship
   *  to make room for a sentence. */
  _evictLines(p) {
    const held = [];
    for (const [zoneId, rows] of ownEntries(p.rel)) {
      for (const [name, row] of ownEntries(rows)) if (row?.s) held.push({ zoneId, name, row, at: posInt(row._sAt, 0) });
    }
    if (held.length <= CAPS.relLines) return;
    held.sort((a, b) => a.at - b.at);
    for (const victim of held.slice(0, held.length - CAPS.relLines)) {
      delete victim.row.s;
      delete victim.row._sAt;
    }
  },

  /** Quest state. `action` is accept | progress | complete | abandon. Board
   *  completions ("b:") are world-FREE (the board is a generated template); pack
   *  completions ("p:") are world-bound and live under quests. */
  quest(core, action, payload, gen) {
    const p = this._live(core, gen);
    if (!p) return false;
    const active = p.quests.active;
    const id = str(payload?.id ?? payload);
    if (action === "accept") {
      if (!id || active.length >= CAPS.activeQuests || active.some((q) => q.id === id)) return false;
      active.push({
        id,
        g: str(payload.g),
        verb: str(payload.verb),
        target: str(payload.target),
        n: Math.max(1, posInt(payload.n, 1)),
        have: 0,
        r: { money: posInt(payload.r?.money, 0), xp: posInt(payload.r?.xp, 0) },
        day: posInt(payload.day, core.sim?.day ?? 0),
      });
      this._touch(core);
      return true;
    }
    const index = active.findIndex((q) => q.id === id);
    if (index < 0) return false;
    const row = active[index];
    if (action === "progress") {
      row.have = PF.clamp(posInt(row.have, 0) + Math.max(1, posInt(payload?.by, 1)), 0, posInt(row.n, 0));
      this._touch(core);
      return row.have >= posInt(row.n, 0);
    }
    if (action === "abandon") {
      active.splice(index, 1);
      this._touch(core);
      return true;
    }
    if (action !== "complete") return false;
    active.splice(index, 1);
    // The completion counter is keyed by the quest's TEMPLATE, not its instance:
    // "b1.d37.2" is the third delivery this world generated, and what the board
    // needs to know is how many deliveries the player has run.
    const template = str(payload?.template ?? row.id);
    const board = template.startsWith("p:") ? p.quests.done_pack : p.quests_done_board;
    const cap = board === p.quests.done_pack ? CAPS.packDone : CAPS.boardDone;
    if (board[template] === undefined && Object.keys(board).length >= cap) {
      // Full. The oldest KEY goes rather than the new completion being dropped:
      // a counter the player can no longer earn is the cheaper loss.
      delete board[Object.keys(board).sort()[0]];
    }
    if (template && template !== "__proto__") board[template] = posInt(board[template], 0) + 1;
    this.award(core, { money: row.r?.money, xp: row.r?.xp, verb: row.verb }, gen);
    this._touch(core);
    return true;
  },

  /** Append a day-ledger line. Refuses a day the gate already covers: those
   *  lines were told and re-telling them is the flaw the gate exists to stop. */
  log(core, text, day, gen) {
    const p = this._live(core, gen);
    if (!p) return false;
    const line = clip(text, CAPS.ledgerChars);
    if (!line) return false;
    const at = posInt(day, core.sim?.day ?? 0);
    if (at <= posInt(p.flushedDay, 0)) return false;
    p.ledger.lines.push([at, line]);
    this._compactLedger(p);
    this._touch(core);
    return true;
  },

  /** Three days in full, one stub per elided day beyond them (plan §4). The
   *  stub is what keeps an unslept week from silently vanishing. */
  _compactLedger(p) {
    const lines = p.ledger.lines;
    const days = [...new Set(lines.map((l) => posInt(l[0], 0)))].sort((a, b) => a - b);
    const full = new Set(days.slice(-CAPS.ledgerDays));
    const out = [];
    const stubbed = new Set();
    for (const day of days) {
      const forDay = lines.filter((l) => posInt(l[0], 0) === day);
      if (full.has(day)) {
        // Newest within the day: an over-long day loses its EARLIEST lines, which
        // are the ones the player is furthest from remembering.
        for (const line of forDay.slice(-CAPS.ledgerPerDay)) out.push(line);
      } else if (!stubbed.has(day)) {
        stubbed.add(day);
        out.push([day, `Day ${day}: ${forDay.length} thing${forDay.length === 1 ? "" : "s"} happened.`]);
      }
    }
    // Bounded stubs, oldest first: an unslept month is a §5 limitation, not a
    // licence to grow the block without end.
    const stubDays = [...stubbed].sort((a, b) => a - b);
    const dropped = new Set(stubDays.slice(0, Math.max(0, stubDays.length - CAPS.ledgerStubs)));
    p.ledger.lines = dropped.size ? out.filter((line) => !dropped.has(posInt(line[0], 0))) : out;
  },

  /** Record a discovery. Composite id (p,e,d) so a sub-zone never collides with
   *  its parent; upserts, because seeing a place twice is not two discoveries. */
  discover(core, entry, gen) {
    const p = this._live(core, gen);
    if (!p) return false;
    const place = str(entry?.p);
    if (!place) return false;
    const row = {
      p: place,
      e: posInt(entry?.e, 0),
      d: posInt(entry?.d, 0),
      day: posInt(entry?.day, core.sim?.day ?? 0),
      seen: entry?.seen !== false,
    };
    const zones = p.found.zones;
    const index = zones.findIndex((z) => z.p === row.p && posInt(z.e, 0) === row.e && posInt(z.d, 0) === row.d);
    if (index >= 0) zones[index] = { ...zones[index], ...row };
    else {
      if (zones.length >= CAPS.found) zones.shift(); // oldest recorded goes first
      zones.push(row);
    }
    this._touch(core);
    return true;
  },

  /** Set the home anchor. A SEALED anchor ("z3") or { minted: true } — never a
   *  bare h{n}, which is a compiler-minted building id that moves with the mint
   *  and would silently rehome the player on the next world change (§2). */
  setHome(core, anchor, gen) {
    const p = this._live(core, gen);
    if (!p) return false;
    if (anchor == null) p.home = null;
    else if (typeof anchor === "string") {
      if (!anchor || /^h\d+$/.test(anchor)) return false;
      p.home = anchor;
    } else if (anchor && anchor.minted === true) p.home = { minted: true };
    else return false;
    this._touch(core);
    return true;
  },
};

// ── The quarantine store (plan §Q1a) ─────────────────────────────────────────
// Its OWN chat-metadata key, never the snapshot and never the route row: the
// whole point of a quarantine is that it survives the write that replaces the
// thing it is holding. Written immediately at creation with the brief path's
// 3-retry backoff, and the in-memory bag is the authority — the same discipline
// PF.save.ensurePresent already applies to the save key, for the same reason
// (~40 engine call sites still use the unqueued whole-blob updateMetadata).
PF.quarantine = {
  MAX_CHARS: QUARANTINE_MAX_CHARS,
  SLOTS: QUARANTINE_SLOTS,
  DROP_ORDER: QUARANTINE_DROP_ORDER,
  _bag: {},
  /** Dedupe for the PATCH, entirely separate from the save path's caches. */
  _bagSerialized: null,
  _chatId: null,

  /** Per-chat: the bag belongs to the chat it was read from. */
  reset() {
    this._bag = {};
    this._bagSerialized = null;
    this._chatId = null;
  },

  /** Boot: read the key into the bag. Called once per chat from PF.save.restore
   *  — deliberately NOT from simFromSaved, which also runs on every rebuild and
   *  would resurrect a slot a re-adoption just consumed. */
  hydrate(meta, chatId) {
    this._chatId = chatId ?? null;
    const raw = meta && typeof meta === "object" ? meta[QUARANTINE_KEY] : null;
    const bag = {};
    if (raw && typeof raw === "object" && !Array.isArray(raw)) {
      for (const slot of QUARANTINE_SLOTS) {
        const entry = raw[slot];
        if (entry && typeof entry === "object" && !Array.isArray(entry)) bag[slot] = entry;
      }
    }
    this._bag = bag;
    this._bagSerialized = Object.keys(bag).length ? JSON.stringify(bag) : null;
    return bag;
  },

  peek(slot) {
    return this._bag[slot] ?? null;
  },

  slots() {
    return Object.keys(this._bag).sort();
  },

  /** FIRST-LOSS-WINS, and per slot. The first thing a slot lost is the thing
   *  furthest from being recoverable any other way; a later loss of the same
   *  kind is usually a repeat of the same cause. Independent across slots — a
   *  full `version` slot must not silence a `migration` loss. */
  put(chatId, slot, entry) {
    if (!QUARANTINE_SLOTS.includes(slot) || !entry || typeof entry !== "object") return false;
    if (this._bag[slot]) return false;
    this._bag[slot] = { at: new Date().toISOString(), ...entry };
    void this._write(chatId ?? this._chatId);
    return true;
  },

  /** Take a slot's contents and clear it in one step — the version slot's
   *  re-adoption CONSUMES it, which is what makes a third boot a no-op. */
  consume(chatId, slot) {
    const entry = this._bag[slot];
    if (!entry) return null;
    delete this._bag[slot];
    void this._write(chatId ?? this._chatId);
    return entry;
  },

  /** Drop a slot without reading it (explicit discard, or invalidation). */
  discard(chatId, slot) {
    if (!this._bag[slot]) return false;
    delete this._bag[slot];
    void this._write(chatId ?? this._chatId);
    return true;
  },

  /** Same self-heal as the save key, and it needs its own branch: the two keys
   *  are written by different code paths and an engine whole-blob write erases
   *  whichever it erases. */
  ensurePresent(core, meta) {
    if (!Object.keys(this._bag).length || !core?.chatId) return;
    if (meta && typeof meta === "object" && meta[QUARANTINE_KEY] == null) {
      this._bagSerialized = null;
      void this._write(core.chatId);
    }
  },

  /** Serialize the bag, dropping least-recoverable first until it fits its own
   *  24 KB ceiling. Mutates the bag: a slot that cannot be stored is not being
   *  held, and pretending otherwise would report a recovery that cannot happen. */
  _serialize() {
    let text = JSON.stringify(this._bag);
    for (const slot of QUARANTINE_DROP_ORDER) {
      if (text.length <= QUARANTINE_MAX_CHARS) break;
      if (!this._bag[slot]) continue;
      console.warn(`[pixelforge] quarantine over ${QUARANTINE_MAX_CHARS} chars; dropping the ${slot} entry`);
      delete this._bag[slot];
      text = JSON.stringify(this._bag);
    }
    return text;
  },

  async _write(chatId) {
    if (!chatId) return false;
    const text = this._serialize();
    if (text === this._bagSerialized) return true;
    const gen = PF.save?._gen ?? 0;
    const payload = Object.keys(this._bag).length ? JSON.parse(text) : null;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        await PF.api.patchMetadata(chatId, { [QUARANTINE_KEY]: payload });
        if (gen === (PF.save?._gen ?? 0)) this._bagSerialized = text;
        return true;
      } catch (err) {
        if (attempt === 2) {
          // The bag is still the authority in memory, and ensurePresent re-tries
          // it on the next props delivery. Losing the WRITE is not losing the
          // entry until the tab does.
          console.warn("[pixelforge] quarantine storage failed; holding it in memory", err);
          return false;
        }
        await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
      }
    }
    return false;
  },
};
