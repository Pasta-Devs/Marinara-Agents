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

// Size caps (plan §4), and they do not all bite the same way. Stated honestly
// because a consumer in slice 6 has to know which calls can come back empty:
//
//   EVICT (the cap makes room and the call succeeds) — relLines evicts the
//     oldest line and leaves its row standing; boardDone / packDone evict the
//     least-earned counter; ledgerDays / ledgerPerDay / ledgerStubs compact the
//     buffer; found evicts the oldest discovery.
//   TRUNCATE (the value is cut, the call succeeds) — lineChars, ledgerChars,
//     skillLevel (the level stops climbing and xp is zeroed at the ceiling).
//   REFUSE (the call does nothing and says so, which is the part the old header
//     denied) — `items`: grant() returns 0 when the pouch is full and the item
//     is a new (t,k) row; `activeQuests`: quest("accept") returns false;
//     `relRows`: bump() returns null when the cap is reached and there is no
//     STRANGER-tier row left to evict for the newcomer.
//
// THESE ARE GAMEPLAY AND HYGIENE BOUNDS, NOT A SIZE BUDGET (maintainer ruling,
// round 2). A previous pass shrank every one of them to hold a saturated town
// inside a 24 KB "design budget" carried over from a mobile-payload worry, and
// what that bought was settlements that feel tiny. The budget is abolished. The
// only real walls are the Engine's per-row cap (MAX_SNAPSHOT_CHARS, 262,144 —
// the server 422s above it) and the browser keepalive quota on the pagehide
// teardown path specifically; a saturated world sits far under both, and
// test-brief case (ah) MEASURES the shape and asserts against those walls rather
// than a budget. Size optimization is explicitly deferred: nothing below is
// chosen for bytes. The numbers are the plan's own.
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
// It lives in its own metadata key, so it competes with nothing — which is why
// this is a TRIPWIRE against a pathological blob bloating the chat's metadata
// and not a size allowance to fit inside (maintainer ruling, round 2). At any
// realistic severance size the overflow logic below should never fire; it stays
// because it is the tripwire's mechanism, and because "held" has to mean held.
const QUARANTINE_MAX_CHARS = 131_072;
// Least-recoverable first (plan §Q1a). `setAside` goes before anything else:
// nothing else in the bag is waiting on a machine to hand it back.
const QUARANTINE_DROP_ORDER = ["setAside", "stamp", "migration", "version"];
const QUARANTINE_SLOTS = ["migration", "stamp", "setAside", "version"];
const QUARANTINE_KEY = "pixelforgeQuarantine";
// `setAside` is the one HUMAN-resolved slot, so it is the one slot that is a
// LIST: a second displaced live block is a second thing to offer the player,
// not a repeat of the first. Bounded by count as well as by the bag's ceiling,
// and its overflow sheds the OLDEST entries first — the newest displacement is
// the one they are most likely to still want back.
const SETASIDE_MAX = 4;
// How many chats' unsettled bag writes are remembered at once (PF.quarantine
// _unsettled). A session visits a handful of chats and each entry is one bag, so
// this is a leak guard rather than a policy: the oldest chat's unstored write is
// the one least likely to still matter.
const UNSETTLED_MAX = 8;

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
// The player-block keys THIS build understands, in wire order. Anything else on
// a restored block was written by a NEWER build at the same `player.v`, and
// serialize() re-emits it rather than dropping it — the same additive-only
// contract ENVELOPE_KEYS gives the envelope one level up (ROADMAP §S5: "unknown
// keys preserved rather than dropped so a downgrade does not silently destroy
// data a newer build wrote"; plan §Q1 "unknown-key retention both levels").
// Additions to serialize()'s literal MUST be added here too.
const PLAYER_KEYS = new Set([
  "v",
  "game",
  "world",
  "flushedDay",
  "pouch",
  "skills",
  "quests_done_board",
  "rel",
  "quests",
  "bought",
  "ledger",
  "found",
  "home",
]);
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
  serialize(player, dropCarry) {
    const p = player && typeof player === "object" ? player : this.defaultPlayer();
    const out = {};
    // UNKNOWN KEYS FIRST, ours assigned over them — the envelope's own order and
    // for the envelope's own reason (60-save snapshot()). A newer build's field
    // at the SAME player.v rides through this build untouched instead of being
    // deleted by the next flush; the too-new version gate only covers a block
    // whose `v` moved, and bumping `v` to ship one additive field costs every
    // older build a defaults boot until re-adoption. Sorted so the bytes cannot
    // drift with the source, emitted only when there are any, so a block this
    // build wrote is byte-identical to one written before the carry existed.
    // `dropCarry` is the pre-flight fallback, threaded down from snapshot().
    if (!dropCarry) {
      for (const key of Object.keys(p).sort()) {
        if (PLAYER_KEYS.has(key) || key === "__proto__") continue;
        if (p[key] === undefined) continue;
        out[key] = p[key];
      }
    }
    out.v = posInt(p.v, currentPlayerV());
    out.game = Math.max(1, posInt(p.game, 1));
    out.world = {
      seed: posInt(p.world?.seed, 0) >>> 0,
      briefHash: posInt(p.world?.briefHash, 0) >>> 0,
      mintStamp: posInt(p.world?.mintStamp, 0) >>> 0,
    };
    // The INTERIM mark (plan §Q3a): a save flushed while standing in the
    // throwaway pre-brief world has all-zero stamps, which is also exactly what
    // a pre-S5 save looks like — and `unstamped` adopts one of those WHOLESALE.
    // The key says which is which. Emitted only when set, so nothing else moves.
    if (p.world?.interim) out.world.interim = 1;
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
            if (line) {
              cell.s = line;
              // …and `a` is the line's RECENCY, which has to survive the wire or
              // "the oldest line is evicted" degrades after a reload into "the
              // alphabetically-first restored row's line is evicted" — the
              // eviction inverts and drops the NEWEST. Emitted only alongside an
              // `s`, so a block with no lines gains no bytes, and only when it is
              // actually SET: a parent build wrote s-lines with no mark at all,
              // and a flat `"a":0` on every one of them would move bytes this
              // change never declared. Absent reads back as 0 through posInt,
              // which is exactly what the ordering already treats it as.
              const seq = posInt(row?.a, 0);
              if (seq) cell.a = seq;
            }
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
        .map((line) => {
          const out = [posInt(line[0], 0), clip(line[1], CAPS.ledgerChars)];
          // A STUB carries the number of lines it stands for as an optional
          // THIRD element, so re-compacting an already-stubbed day preserves
          // the count instead of collapsing "12 things" to "1 thing" on the
          // next append. Plain lines stay two-element and gain no bytes.
          const n = posInt(line[2], 0);
          if (n > 0) out.push(n);
          return out;
        }),
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
    if (!this.stampsEvaluable(world, brief, briefExpected)) {
      // Nothing to compare against — but an INTERIM world still leaves a mark.
      // A save flushed while standing in the throwaway pre-brief world is
      // all-zero, and all-zero is also what a pre-S5 save looks like, so the
      // next boot's `unstamped` branch would adopt it WHOLESALE into the
      // compiled world: relationship rows, quests and discoveries belonging to
      // people the sealed brief never named. Marked, the same boot takes the
      // severance path instead, which is the transplant's split by another
      // name. Only a block that is bare or already interim is marked; a block
      // carrying real stamps is evidence about a real world and keeps them.
      const held = player.world;
      const bare = !held || held.interim === 1 || (!held.seed && !held.briefHash && !held.mintStamp);
      if (world && world.interim && bare) {
        player.world = { seed: (world.seed ?? 0) >>> 0, briefHash: 0, mintStamp: 0, interim: 1 };
      }
      return { severed: null, notices, evaluated: false };
    }
    const was = player.world;
    // A block with no stamps of its own (a pre-S5 save, or a fresh default) has
    // nothing to disagree with: stamp it and move on. An INTERIM-marked block is
    // not one of those — it is a save that knows which world it came from, and
    // that world is not this one.
    const unstamped = !was || (!was.interim && !was.seed && !was.briefHash && !was.mintStamp);
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
      // `bought` is world-BOUND (plan §2 puts it under the world-bound banner):
      // it counts what a NAMED shop's stock has lost, and both the shop and its
      // stock table are compiled from the brief. Carried across a brief change
      // it depletes a stranger's shelves.
      entry.fields.bought = player.bought;
      player.rel = {};
      player.quests = { done_pack: {}, active: [] };
      player.found = { zones: [] };
      player.home = null;
      player.bought = null;
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
    // How many of the active quests were LIVE before the merge: the dedupe below
    // has to prefer the row the player is currently playing over the parked copy
    // of the same quest.
    const liveQuests = Array.isArray(player.quests?.active) ? player.quests.active.length : 0;
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
      // `bought` was severed with the rest of the world-bound set, so it comes
      // home with them.
      if (fields.bought !== undefined)
        player.bought = fields.bought && typeof fields.bought === "object" ? fields.bought : null;
    }
    // THE GUARD, re-applied rather than trusted. A restored line at or below the
    // gate would never be told: the flush skips everything the gate covers.
    const lines = Array.isArray(player.ledger?.lines) ? player.ledger.lines : [];
    if (lines.length) {
      const minDay = lines.reduce((low, line) => Math.min(low, posInt(line[0], 0)), Infinity);
      player.flushedDay = Math.max(0, Math.min(posInt(player.flushedDay, 0), minDay - 1));
    }
    // EVERY OTHER INVARIANT, re-applied for the same reason. Restoration is the
    // one path that puts state back WITHOUT going through a mutator, so the caps
    // and the dedupes the mutators enforce have to be re-run here or the block
    // lands at twice the row cap with two copies of the same quest id in it.
    this._enforceCaps(player, entry.reason === "mint" ? liveQuests : 0);
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
    // `bought` does NOT cross: it is world-bound (plan §2), and the shops it
    // counts against were compiled from a brief that did not exist yet. It goes
    // to the stamp slot with the rest of the world-bound set below.
    // A newer build's unknown player-level keys DO cross, exactly as the
    // envelope's carry does across this same seam (60-save maybeGenerateBrief):
    // they are not this build's play state to reinterpret or to throw away.
    for (const key of Object.keys(source)) {
      if (PLAYER_KEYS.has(key) || key === "__proto__") continue;
      if (source[key] === undefined) continue;
      next[key] = source[key];
    }
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
      ownEntries(source.bought).length ||
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
              bought: source.bought ?? null,
              home: source.home ?? null,
              ledgerLines: lines,
              flushedDayWas: posInt(source.flushedDay, 0),
              flushedDay,
            },
          },
        }
      : null;
    next.world = this.stampsFor(world, brief);
    // The world-free half crossed without a mutator too, so it gets the same
    // re-enforcement restoreStamped gets.
    this._enforceCaps(next, 0);
    const normalized = this.serialize(next);
    normalized.v = currentPlayerV();
    if (normalized.bought === undefined) normalized.bought = null;
    return { player: normalized, severed };
  },

  // ── Re-entry invariants (plan §3, §4) ──────────────────────────────────────

  /** Dedupe active quests by id. `liveCount` is how many of the leading rows
   *  came from the LIVE block: the row the player is playing wins outright, and
   *  two parked copies of one quest fall back to whichever got further. */
  _dedupeActive(active, liveCount) {
    const held = new Map();
    active.forEach((q, index) => {
      const id = str(q?.id);
      if (!id) return;
      const live = index < liveCount;
      const prior = held.get(id);
      if (!prior) {
        held.set(id, { q, live });
        return;
      }
      if (prior.live) return;
      if (live || posInt(q?.have, 0) > posInt(prior.q?.have, 0)) held.set(id, { q, live });
    });
    return [...held.values()].map((row) => row.q);
  },

  /** Every cap and every dedupe the MUTATORS enforce, re-applied to a block that
   *  did not come through one. Restoration and the transplant both put whole
   *  fields back by assignment, so this is the only thing between a quarantine
   *  entry and a block at twice the row cap with duplicate quest ids in it —
   *  and it runs BEFORE the normalizing serialize, so what it trims never
   *  reaches the wire. */
  _enforceCaps(p, liveQuests) {
    if (!p || typeof p !== "object") return p;
    // Pouch. Deterministic by (t,k) so the survivors do not depend on merge
    // order; serialize() sorts the same way.
    if (Array.isArray(p.pouch?.items) && p.pouch.items.length > CAPS.items) {
      p.pouch.items = p.pouch.items
        .slice()
        .sort((a, b) =>
          str(a?.t) === str(b?.t)
            ? str(a?.k) < str(b?.k)
              ? -1
              : str(a?.k) > str(b?.k)
                ? 1
                : 0
            : str(a?.t) < str(b?.t)
              ? -1
              : 1,
        )
        .slice(0, CAPS.items);
    }
    // Skills: the level ladder has a ceiling and xp is zeroed at it.
    for (const [, row] of ownEntries(p.skills?.verbs)) {
      if (row && typeof row === "object" && posInt(row.l, 1) >= CAPS.skillLevel) {
        row.l = CAPS.skillLevel;
        row.x = 0;
      }
    }
    // Completion counters: the LEAST-earned one is the cheaper loss, exactly as
    // quest() decides it at the live cap.
    this._trimCounters(p.quests_done_board, CAPS.boardDone);
    if (p.quests && typeof p.quests === "object") this._trimCounters(p.quests.done_pack, CAPS.packDone);
    this._trimNested(p.bought, CAPS.bought);
    // Active quests: dedupe first (a merge is where duplicate ids come from),
    // then the cap.
    if (p.quests && Array.isArray(p.quests.active)) {
      p.quests.active = this._dedupeActive(p.quests.active, posInt(liveQuests, 0));
      if (p.quests.active.length > CAPS.activeQuests) p.quests.active = p.quests.active.slice(0, CAPS.activeQuests);
    }
    // Relationships: the row cap evicts STRANGERS, the line cap evicts lines.
    // The loop stops when there is no stranger left rather than eating rows the
    // player built something with — the same trade bump() makes.
    let guard = CAPS.relRows * 2 + 8;
    while (this._relRowCount(p) > CAPS.relRows && guard-- > 0 && this._evictStranger(p));
    // …and then the cap holds WHATEVER is left (round-2 fix). The stranger pass
    // can run out of strangers with the block still over: hostile rows are not
    // strangers, so a hostile-on-hostile restore arrives at twice the cap and
    // the pass has nothing it is willing to take. A cap that a restore can walk
    // through is not a cap.
    this._evictToRowCap(p);
    this._evictLines(p);
    // Discoveries: the OLDEST by day goes, which is what the cap has always
    // claimed and what the array order stopped meaning after a reload.
    if (Array.isArray(p.found?.zones) && p.found.zones.length > CAPS.found) {
      p.found.zones = p.found.zones
        .map((zone, index) => ({ zone, index }))
        .sort((a, b) => posInt(b.zone?.day, 0) - posInt(a.zone?.day, 0) || a.index - b.index)
        .slice(0, CAPS.found)
        .sort((a, b) => a.index - b.index)
        .map((row) => row.zone);
    }
    if (p.ledger && Array.isArray(p.ledger.lines)) this._compactLedger(p);
    return p;
  },

  /** Trim a `{key: count}` map to `cap`, dropping the least-earned keys first
   *  (sorted-key tiebreak, so two equal counts resolve the same way twice). */
  _trimCounters(map, cap) {
    const rows = ownEntries(map);
    if (rows.length <= cap) return;
    const doomed = rows
      .slice()
      .sort((a, b) => posInt(a[1], 0) - posInt(b[1], 0) || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
      .slice(0, rows.length - cap);
    for (const [key] of doomed) delete map[key];
  },

  /** …and the same for `bought`, which is a map OF maps: the cap counts leaf
   *  rows, and a shop left with nothing in it goes with its last row. */
  _trimNested(map, cap) {
    const leaves = [];
    for (const [shop, rows] of ownEntries(map)) for (const [t, n] of ownEntries(rows)) leaves.push({ shop, t, n });
    if (leaves.length <= cap) return;
    const doomed = leaves
      .slice()
      .sort(
        (a, b) =>
          posInt(a.n, 0) - posInt(b.n, 0) ||
          (a.shop < b.shop ? -1 : a.shop > b.shop ? 1 : 0) ||
          (a.t < b.t ? -1 : a.t > b.t ? 1 : 0),
      )
      .slice(0, leaves.length - cap);
    for (const leaf of doomed) {
      delete map[leaf.shop][leaf.t];
      if (!ownEntries(map[leaf.shop]).length) delete map[leaf.shop];
    }
  },

  /** Own-property bucket access, shared by every map-write site. Two hazards in
   *  one helper: JSON.parse hands "__proto__" back as an own property and
   *  assigning it onto a plain object sets the PROTOTYPE instead of a key, and a
   *  bare `map[key]` READ walks the prototype chain — `map.constructor` is a
   *  function, `map.toString` is a function, and either one read as "the row
   *  that is already there" corrupts the block or bricks the next Sim build.
   *  Returns null for a key no bucket may exist at. */
  _ownRead(map, key) {
    if (!map || typeof map !== "object" || key === "__proto__") return undefined;
    return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : undefined;
  },

  /** Read-or-create an object bucket at `key`. Null when the key is one no
   *  bucket may exist at, so every caller has one refusal to handle. */
  _bucket(map, key) {
    if (!map || typeof map !== "object" || key === "__proto__") return null;
    const held = this._ownRead(map, key);
    if (held && typeof held === "object" && !Array.isArray(held)) return held;
    const fresh = {};
    map[key] = fresh;
    return fresh;
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
    // THE LOADING GATE (plan §Q3b): a world nobody has entered has no player in
    // it. Refused HERE rather than at nine call sites, which is what makes "no
    // mutator is reachable while the gate holds" true of every verb at once —
    // including the ones written after the gate. Each verb's documented refusal
    // value is what a caller gets, so nothing has to learn a new failure shape.
    if (PF.save?.gateHolds?.(core)) return null;
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
    // `verb` reaches here from quest payloads, which are untrusted save data:
    // a bare `p.skills.verbs[verb]` read resolves "constructor" to a function
    // and "__proto__" assignment repoints the map's prototype.
    if (xp && verb && verb !== "__proto__") {
      row = this._ownRead(p.skills.verbs, verb);
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
    // VALIDATE BEFORE ALLOCATING. The old order minted the verb's bucket first
    // and only then refused a nameless item, leaving `{"fishing":{}}` in the
    // saved block — junk written by a call that reported doing nothing, and
    // written without _touch, so nothing even knew it was there.
    let pair = null;
    if (item != null) {
      const { t, k } = this._itemKey(item);
      if (!t) return false;
      pair = [t, k];
    }
    const slots = this._bucket(p.skills.equipped, name);
    if (!slots) return false;
    if (pair) slots[slot] = pair;
    else delete slots[slot];
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
    if (!zone || !who || zone === "__proto__" || who === "__proto__") return null;
    const heldRows = this._ownRead(p.rel, zone);
    const held = heldRows && typeof heldRows === "object" ? this._ownRead(heldRows, who) : undefined;
    let row = held && typeof held === "object" ? held : null;
    if (!row) {
      // VALIDATE BEFORE ALLOCATING, same reason as equip(): the old order minted
      // the ZONE bucket, then refused at the row cap, and left an empty zone in
      // the block that no _touch ever announced. The eviction can delete the
      // zone bucket, so the bucket is resolved after it, never before.
      if (this._relRowCount(p) >= CAPS.relRows && !this._evictStranger(p)) return null;
      const rows = this._bucket(p.rel, zone);
      if (!rows) return null;
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
          // Recency, derived from the BLOCK rather than a module counter: the
          // counter restarted at zero on every reload while restored rows kept
          // their old marks, so the first line written after a reload sorted as
          // the oldest and was the first one evicted.
          row.a = this._nextLineSeq(p);
          this._evictLines(p);
        } else {
          delete row.s;
          delete row.a;
        }
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

  /** The next `s`-line recency mark, one past the highest the block holds. Read
   *  off the block so it survives a reload; at most CAPS.relRows rows, and only
   *  on a patch that actually carries a line. */
  _nextLineSeq(p) {
    let top = 0;
    for (const [, rows] of ownEntries(p.rel)) {
      for (const [, row] of ownEntries(rows)) top = Math.max(top, posInt(row?.a, 0));
    }
    return top + 1;
  },

  /** Evict one STRANGER-tier row (d === 0, fewest encounters, no line, NOT
   *  hostile). A row the player has actually built something with is never the
   *  one that goes — and an enemy is something built. Forgetting the person the
   *  player made hostile is the one eviction they would notice. */
  _evictStranger(p) {
    let worst = null;
    for (const [zoneId, rows] of ownEntries(p.rel)) {
      for (const [name, row] of ownEntries(rows)) {
        if (posInt(row?.d, 0) !== 0 || row?.s || row?.h) continue;
        if (!worst || posInt(row?.t, 0) < worst.t) worst = { zoneId, name, t: posInt(row?.t, 0) };
      }
    }
    if (!worst) return false;
    delete p.rel[worst.zoneId][worst.name];
    if (!ownEntries(p.rel[worst.zoneId]).length) delete p.rel[worst.zoneId];
    return true;
  },

  /** The row cap's LAST RESORT, for the paths that put whole fields back by
   *  assignment (restoration, the transplant) rather than one bump() at a time.
   *  `_evictStranger` is a preference — it refuses to take a row the player
   *  built something with — and a preference cannot be the only thing holding an
   *  invariant. Here the rows are ordered cheapest-loss-first (the ladder tier,
   *  then whether a remembered line hangs off it, then hostility — an enemy is
   *  something built — then encounters, then the name for a tie that resolves
   *  the same way twice) and the head of that order goes until the count fits.
   *  A row the player built something with is still never the FIRST to go; it is
   *  just no longer exempt once nothing cheaper is left. */
  _evictToRowCap(p) {
    const over = this._relRowCount(p) - CAPS.relRows;
    if (over <= 0) return;
    const rows = [];
    for (const [zoneId, cells] of ownEntries(p.rel)) {
      for (const [name, row] of ownEntries(cells)) {
        rows.push({
          zoneId,
          name,
          d: PF.clamp(posInt(row?.d, 0), 0, 3),
          line: row?.s ? 1 : 0,
          h: row?.h ? 1 : 0,
          t: posInt(row?.t, 0),
        });
      }
    }
    rows.sort(
      (a, b) =>
        a.d - b.d ||
        a.line - b.line ||
        a.h - b.h ||
        a.t - b.t ||
        (a.zoneId < b.zoneId ? -1 : a.zoneId > b.zoneId ? 1 : a.name < b.name ? -1 : a.name > b.name ? 1 : 0),
    );
    for (const victim of rows.slice(0, over)) {
      delete p.rel[victim.zoneId][victim.name];
      if (!ownEntries(p.rel[victim.zoneId]).length) delete p.rel[victim.zoneId];
    }
  },

  /** The LINE cap, which is not the row cap: past thirty lines the OLDEST line
   *  is dropped and its row stays exactly where it was, with its ladder and its
   *  encounter count intact. Losing the row instead would lose the relationship
   *  to make room for a sentence. */
  _evictLines(p) {
    const held = [];
    for (const [zoneId, rows] of ownEntries(p.rel)) {
      for (const [name, row] of ownEntries(rows)) if (row?.s) held.push({ zoneId, name, row, at: posInt(row.a, 0) });
    }
    if (held.length <= CAPS.relLines) return;
    // `a` is serialized, so this ordering means the same thing on the boot after
    // a reload as it did in the session that wrote it.
    held.sort((a, b) => a.at - b.at);
    for (const victim of held.slice(0, held.length - CAPS.relLines)) {
      delete victim.row.s;
      delete victim.row.a;
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
    // Own-property read: `board["constructor"]` is a function, not undefined, so
    // a bare read skips the cap check entirely on a template named after one.
    const standing = this._ownRead(board, template);
    if (standing === undefined && ownEntries(board).length >= cap) {
      // Full, so one counter goes rather than the new completion being dropped.
      // The LEAST-EARNED one: "oldest key" was alphabetical order dressed up as
      // recency (a completion counter carries no day to sort by), and a counter
      // at 1 is the cheaper loss than one the player earned nine times.
      this._trimCounters(board, cap - 1);
    }
    if (template && template !== "__proto__") board[template] = posInt(standing, 0) + 1;
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
        // IDEMPOTENT. A stub carries the count it stands for as a third element,
        // so re-stubbing an already-stubbed day adds its count back instead of
        // counting the one stub LINE — which is how an elided day that held
        // twelve things became "1 thing happened." on the next append.
        const n = forDay.reduce((sum, line) => sum + Math.max(1, posInt(line[2], 0)), 0);
        out.push([day, `Day ${day}: ${n} thing${n === 1 ? "" : "s"} happened.`, n]);
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
      if (zones.length >= CAPS.found) {
        // The oldest by DAY, not the array-first row: serialize() re-orders the
        // array by (p,e,d), so after any reload `shift()` drops whatever sorts
        // first alphabetically and calls it the oldest discovery. Ties break on
        // the insertion index, which is what array-first meant when it worked.
        let victim = 0;
        for (let i = 1; i < zones.length; i++) {
          if (posInt(zones[i]?.day, 0) < posInt(zones[victim]?.day, 0)) victim = i;
        }
        zones.splice(victim, 1);
      }
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

/** The `setAside` slot's list view, tolerant of the pre-list single-entry shape
 *  a build before this one wrote (and of a hand-edited key). */
const asideEntries = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  if (Array.isArray(value.entries)) {
    return value.entries.filter((entry) => entry && typeof entry === "object" && !Array.isArray(entry));
  }
  return [value];
};

/** Union two severance entries into one. The HELD entry is the anchor: its
 *  stamps and its reason are what a returning world is matched against, and the
 *  first loss is the one that has been waiting longest for that match. Only the
 *  FIELDS merge, and each one merges the way its own shape means:
 *    rel        union per person, the higher-tier cell winning a collision
 *    quests     concatenated and deduped by id
 *    found      union by the composite (p,e,d) key
 *    counters   union, the higher count winning
 *    ledger     concatenated, newest kept, bounded by the live buffer's caps
 *    home       the held one — two homes are not a home
 *  A field only one side carries crosses untouched. */
const mergeStampEntries = (held, incoming) => {
  const a = held.fields && typeof held.fields === "object" ? held.fields : {};
  const b = incoming.fields && typeof incoming.fields === "object" ? incoming.fields : {};
  const fields = { ...b, ...a };
  // rel: {zone: {name: cell}}. Higher `d` wins, then more encounters, then held.
  if (a.rel || b.rel) {
    const merged = {};
    for (const source of [b.rel, a.rel]) {
      for (const [zoneId, rows] of ownEntries(source)) {
        const target = merged[zoneId] ?? (merged[zoneId] = {});
        for (const [name, row] of ownEntries(rows)) {
          const standing = Object.prototype.hasOwnProperty.call(target, name) ? target[name] : undefined;
          if (
            !standing ||
            posInt(row?.d, 0) > posInt(standing?.d, 0) ||
            (posInt(row?.d, 0) === posInt(standing?.d, 0) && posInt(row?.t, 0) > posInt(standing?.t, 0))
          ) {
            target[name] = row;
          }
        }
      }
    }
    fields.rel = merged;
  }
  if (Array.isArray(a.questsActive) || Array.isArray(b.questsActive)) {
    const byId = new Map();
    for (const quest of [
      ...(Array.isArray(b.questsActive) ? b.questsActive : []),
      ...(Array.isArray(a.questsActive) ? a.questsActive : []),
    ]) {
      const id = str(quest?.id);
      if (!id) continue;
      const standing = byId.get(id);
      if (!standing || posInt(quest?.have, 0) > posInt(standing?.have, 0)) byId.set(id, quest);
    }
    fields.questsActive = [...byId.values()];
  }
  for (const key of ["questsDonePack", "bought"]) {
    if (!a[key] && !b[key]) continue;
    const merged = {};
    for (const source of [b[key], a[key]]) {
      for (const [outer, value] of ownEntries(source)) {
        if (value && typeof value === "object" && !Array.isArray(value)) {
          const target = merged[outer] ?? (merged[outer] = {});
          for (const [inner, n] of ownEntries(value)) target[inner] = Math.max(posInt(target[inner], 0), posInt(n, 0));
        } else {
          merged[outer] = Math.max(posInt(merged[outer], 0), posInt(value, 0));
        }
      }
    }
    fields[key] = merged;
  }
  if (Array.isArray(a.found) || Array.isArray(b.found)) {
    const byKey = new Map();
    for (const zone of [...(Array.isArray(b.found) ? b.found : []), ...(Array.isArray(a.found) ? a.found : [])]) {
      if (!zone || typeof zone !== "object") continue;
      byKey.set(`${str(zone.p)}|${posInt(zone.e, 0)}|${posInt(zone.d, 0)}`, zone);
    }
    fields.found = [...byKey.values()].slice(-CAPS.found);
  }
  if (Array.isArray(a.ledgerLines) || Array.isArray(b.ledgerLines)) {
    const lines = [
      ...(Array.isArray(a.ledgerLines) ? a.ledgerLines : []),
      ...(Array.isArray(b.ledgerLines) ? b.ledgerLines : []),
    ].filter((line) => Array.isArray(line) && line.length >= 2);
    const cap = CAPS.ledgerDays * CAPS.ledgerPerDay + CAPS.ledgerStubs;
    fields.ledgerLines = lines.length > cap ? lines.slice(-cap) : lines;
  }
  if (a.home !== undefined || b.home !== undefined) fields.home = a.home !== undefined ? a.home : b.home;
  for (const key of ["flushedDay", "flushedDayWas"]) {
    if (a[key] === undefined && b[key] === undefined) continue;
    // The LOWER gate: whatever comes home must not land at or below it.
    fields[key] = Math.min(posInt(a[key], Infinity), posInt(b[key], Infinity));
    if (!Number.isFinite(fields[key])) fields[key] = 0;
  }
  return { ...held, fields, mergedCount: posInt(held.mergedCount, 1) + 1 };
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
  /** THE SINGLE WRITER (slice-4 fix). Every bag write goes down one promise
   *  chain, the same arrangement PF.save._flushChain makes for the snapshot and
   *  for the same reason: the writes used to be `void this._write(...)`, each
   *  with its own retry loop, and the version re-adoption fires THREE of them in
   *  one synchronous stretch. Nothing ordered them, so a retried snapshot could
   *  land last and put an invalidated slot back on disk — or erase a park that
   *  memory still held. Serialized, the last bag state is the only thing that
   *  reaches the wire and disk converges on newest memory. */
  _writeChain: null,
  /** `{ id, holder }` for the write already queued but not yet running: the chat
   *  it belongs to, and the box it will read its payload out of. A second
   *  request for the same chat refreshes the holder rather than adding a round
   *  trip that sends the same bytes twice.
   *
   *  THE HOLDER IS BOUND TO THE TASK, not to this object, and that is the whole
   *  point (round-2 fix). The payload used to live in a field the queued task
   *  read at RUN time, so reset() — which must clear it, or task A writes chat
   *  B's bytes — left the queued task reading null and _writeNow dropped it on
   *  the floor. The severance parked at the moment of leaving a chat never
   *  reached that chat's disk. Now reset() clears the POINTER and the departing
   *  chat's task still holds the box it was given. */
  _pending: null,
  /** chatId → the bag bytes a write for that chat produced that are NOT known to
   *  have reached disk: queued, in flight, or failed out. Bounded by chat count.
   *
   *  THE HOLDER ALONE IS NOT ENOUGH, and the case that proves it is a two-chat
   *  round trip inside one un-drained chain. Park something on chat A, glance at
   *  B, and come back to A before A's queued write has run: hydrate() rebuilds
   *  the bag from DISK — which does not have the park, because the write never
   *  landed — and sets the dedupe cache to those bytes. The queued task then
   *  wakes, sees `_chatId === "A"`, re-serializes the live bag it now finds (the
   *  disk bag), and the dedupe says "already stored". The write is dropped and
   *  the park is gone from disk AND from memory, on the one path most likely to
   *  have produced a park in the first place.
   *
   *  So an unsettled write is remembered BY CHAT, and hydrate() prefers it over
   *  the disk read for that chat. That is the module's stated invariant being
   *  served rather than broken: the in-memory bag is the authority, and a disk
   *  read that silently demotes it to a stale copy is the bug. `_bagSerialized`
   *  keeps meaning exactly what it always meant — what we believe DISK holds — so
   *  the next write correctly sees the adopted bag as something disk still needs.
   *
   *  Kept across reset() on purpose, and deliberately NOT cleared when a write
   *  fails out: an entry nobody managed to store is precisely the one worth
   *  re-trying on the next visit, which is the self-heal ensurePresent already
   *  performs for the key as a whole. */
  _unsettled: new Map(),

  /** Per-chat: the bag belongs to the chat it was read from. `_writeChain` is
   *  deliberately NOT cleared, exactly as PF.save._flushChain is not: the
   *  departing chat's queued write rides it and must land before the arriving
   *  chat's first one. */
  reset() {
    this._bag = {};
    this._bagSerialized = null;
    this._chatId = null;
    this._pending = null;
  },

  /** Boot: read the key into the bag. Called once per chat from PF.save.restore
   *  — deliberately NOT from simFromSaved, which also runs on every rebuild and
   *  would resurrect a slot a re-adoption just consumed. */
  hydrate(meta, chatId) {
    this._chatId = chatId ?? null;
    const raw = meta && typeof meta === "object" ? meta[QUARANTINE_KEY] : null;
    const readBag = (value) => {
      const bag = {};
      if (!value || typeof value !== "object" || Array.isArray(value)) return bag;
      for (const slot of QUARANTINE_SLOTS) {
        const entry = value[slot];
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
        // `setAside` is a list on the wire now. Tolerant in both directions: a
        // key written before it was one is read as its single entry, and a bag
        // holding one entry writes the same shape a reader of either build
        // understands.
        bag[slot] = slot === "setAside" ? { entries: asideEntries(entry) } : entry;
      }
      if (bag.setAside && !bag.setAside.entries.length) delete bag.setAside;
      return bag;
    };
    const bag = readBag(raw);
    // WHAT DISK HOLDS, recorded before anything is preferred over it. That is the
    // dedupe's whole meaning and it has to keep describing DISK even when the bag
    // below does not — otherwise the very next write believes disk already has
    // what only memory has (see _unsettled).
    this._bagSerialized = Object.keys(bag).length ? JSON.stringify(bag) : null;
    // An unsettled write for THIS chat is newer than the disk read by
    // construction: it was produced from this session's own bag and never reached
    // the wire. Adopt it, so the bag stays the authority and the next write still
    // owes disk the difference.
    const held = chatId ? this._unsettled.get(chatId) : null;
    if (held) {
      let parked = null;
      try {
        parked = JSON.parse(held);
      } catch {
        parked = null; // unparseable is not recoverable; the disk read stands
      }
      if (parked) {
        this._bag = readBag(parked);
        return this._bag;
      }
    }
    this._bag = bag;
    return bag;
  },

  /** The slot's entry — for `setAside`, the OLDEST of its list, which is the
   *  displaced block a single-entry caller means. `peekAll` is the list view. */
  peek(slot) {
    if (slot === "setAside") return asideEntries(this._bag.setAside)[0] ?? null;
    return this._bag[slot] ?? null;
  },

  peekAll(slot) {
    if (slot === "setAside") return asideEntries(this._bag.setAside);
    return this._bag[slot] ? [this._bag[slot]] : [];
  },

  slots() {
    return Object.keys(this._bag).sort();
  },

  /** Per slot, and the three kinds do NOT behave the same way.
   *
   *  `migration` / `version` — FIRST-LOSS-WINS, unchanged. The first thing
   *    either slot lost is the one furthest from being recoverable any other
   *    way, and a later loss of the same kind is a repeat of the same cause.
   *
   *  `stamp` — MERGES. This slot was one-shot too, and that was a data-loss bug
   *    with a lie on top: applyStamps STRIPS the live block before offering the
   *    entry, so a second severance found the slot full, got `false` back, and
   *    deleted everything it had just stripped — while still telling the player
   *    it had been set aside. Severance parking is lossless while the bag has
   *    room. The HELD entry stays the anchor (its stamps, its reason, its `at`
   *    — the first loss is the one a returning world is matched against) and the
   *    incoming fields are unioned into it.
   *
   *  `setAside` — APPENDS, bounded. It is human-resolved, so a second displaced
   *    live block is a second thing to offer them, not a duplicate.
   *
   *  Slots stay independent: a full `version` slot must not silence a
   *  `migration` loss. Returns false when nothing was stored, and NO CALLER may
   *  drop that on the floor — the whole bug class above is one unread return. */
  put(chatId, slot, entry) {
    if (!QUARANTINE_SLOTS.includes(slot) || !entry || typeof entry !== "object") return false;
    const stamped = { at: new Date().toISOString(), ...entry };
    let next;
    if (slot === "setAside") {
      const held = asideEntries(this._bag.setAside);
      const entries = [...held, stamped];
      while (entries.length > SETASIDE_MAX) entries.shift(); // oldest first, as overflow drops
      next = { entries };
    } else if (slot === "stamp" && this._bag.stamp) {
      next = mergeStampEntries(this._bag.stamp, stamped);
    } else if (this._bag[slot]) {
      return false;
    } else {
      next = stamped;
    }
    // FIT-CHECK BEFORE MUTATING (slice-4 fix). The drop loop used to run after
    // the fact, so an entry too large to store spent every OTHER slot on its way
    // to being dropped itself — while `put` had already returned true. An entry
    // that cannot be held even alone is refused here, with the bag untouched.
    if (JSON.stringify({ [slot]: next }).length > QUARANTINE_MAX_CHARS) return false;
    this._bag[slot] = next;
    void this._write(chatId ?? this._chatId);
    return true;
  },

  /** THE CONTRACT: `consume` is `peek` that also takes. It returns exactly what
   *  `peek(slot)` would have returned and removes exactly that — for `setAside`,
   *  the OLDEST entry, leaving the rest of the list in the bag for the next
   *  caller. `consumeAll` is the bulk verb and pairs with `peekAll`.
   *
   *  Stated because it was not true (round-2 fix): consume returned `setAside`'s
   *  LIST WRAPPER while peek returned an entry, so the one slot a human resolves
   *  one item at a time was also the one slot whose two readers disagreed about
   *  what they were handing back. Slice 6's resolution UI is the first live
   *  caller and would have found it the hard way.
   *
   *  The version slot's re-adoption consumes it, which is what makes a third
   *  boot a no-op. */
  consume(chatId, slot) {
    if (slot === "setAside") {
      const entries = asideEntries(this._bag.setAside);
      const oldest = entries.shift();
      if (!oldest) return null;
      if (entries.length) this._bag.setAside = { entries };
      else delete this._bag.setAside;
      void this._write(chatId ?? this._chatId);
      return oldest;
    }
    const entry = this._bag[slot];
    if (!entry) return null;
    delete this._bag[slot];
    void this._write(chatId ?? this._chatId);
    return entry;
  },

  /** Take the WHOLE slot: the list for `setAside`, a one-element list for the
   *  others, `[]` when it is empty. The bulk mirror of `peekAll`. */
  consumeAll(chatId, slot) {
    const held = this.peekAll(slot);
    if (!held.length) return [];
    delete this._bag[slot];
    void this._write(chatId ?? this._chatId);
    return held;
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
   *  QUARANTINE_MAX_CHARS ceiling — which a realistic severance is nowhere near,
   *  so this is the tripwire firing rather than routine housekeeping. Mutates
   *  the bag: a slot that cannot be stored is not being held, and pretending
   *  otherwise would report a recovery that cannot happen. */
  _serialize() {
    let text = JSON.stringify(this._bag);
    if (text.length <= QUARANTINE_MAX_CHARS) return text;
    // An entry that cannot be stored EVEN ALONE goes first, whatever the drop
    // order says. Keeping it costs every other slot and buys nothing: the old
    // loop worked down the order, emptied the bag, and then dropped the
    // oversized entry too. `put`'s fit-check keeps one out of the bag in the
    // first place; this catches one that grew there through a stamp merge.
    for (const slot of QUARANTINE_SLOTS) {
      if (text.length <= QUARANTINE_MAX_CHARS) break;
      if (!this._bag[slot]) continue;
      if (JSON.stringify({ [slot]: this._bag[slot] }).length <= QUARANTINE_MAX_CHARS) continue;
      console.warn(`[pixelforge] the quarantine ${slot} entry does not fit the bag even alone; dropping it`);
      delete this._bag[slot];
      text = JSON.stringify(this._bag);
    }
    for (const slot of QUARANTINE_DROP_ORDER) {
      if (text.length <= QUARANTINE_MAX_CHARS) break;
      if (!this._bag[slot]) continue;
      if (slot === "setAside") {
        // The one LIST sheds its oldest entries one at a time before the slot
        // itself goes: the newest displaced block is the one the player is most
        // likely to still want back.
        const entries = asideEntries(this._bag.setAside);
        while (entries.length > 1 && text.length > QUARANTINE_MAX_CHARS) {
          entries.shift();
          this._bag.setAside = { entries: [...entries] };
          text = JSON.stringify(this._bag);
        }
        if (text.length <= QUARANTINE_MAX_CHARS) break;
      }
      console.warn(`[pixelforge] quarantine over ${QUARANTINE_MAX_CHARS} chars; dropping the ${slot} entry`);
      delete this._bag[slot];
      text = JSON.stringify(this._bag);
    }
    return text;
  },

  /** Enqueue a bag write. Collapses onto the queued one for the same chat and
   *  serializes behind everything already on the chain. */
  _write(chatId) {
    const id = chatId ?? this._chatId;
    if (!id) return Promise.resolve(false);
    if (this._chatId === null) this._chatId = id;
    const captured = this._serialize();
    // Remembered per chat from the moment the write is ASKED FOR, not from the
    // moment it runs: everything between here and a landed PATCH is a window in
    // which a chat round trip can lose it (see _unsettled).
    this._unsettled.delete(id);
    this._unsettled.set(id, captured);
    while (this._unsettled.size > UNSETTLED_MAX) this._unsettled.delete(this._unsettled.keys().next().value);
    if (this._pending?.id === id) {
      // Already queued for this chat: refresh the holder the queued task will
      // read and let it carry the newest bytes. Two PATCHes of the same bytes
      // are exactly the reordering hazard this chain exists to remove.
      this._pending.holder.text = captured;
      return this._writeChain;
    }
    const holder = { text: captured };
    this._pending = { id, holder };
    const task = () => {
      // Only clear the pointer if it is still OURS. After a chat switch it
      // belongs to the arriving chat, and clearing that would make the next
      // write for it queue a second task instead of collapsing into the first.
      if (this._pending?.holder === holder) this._pending = null;
      return this._writeNow(id, holder.text);
    };
    this._writeChain = (this._writeChain ?? Promise.resolve()).then(task, task);
    return this._writeChain;
  },

  async _writeNow(chatId, captured) {
    const gen = PF.save?._gen ?? 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      // RE-READ THE BAG EVERY ATTEMPT. A retry that lands 500 ms later must
      // carry what the bag holds NOW, not the snapshot the first attempt froze
      // — that snapshot is how a retried write resurrected a slot a later
      // consume() had already cleared. Once the chat has moved on the live bag
      // is somebody else's and the captured bytes are what this id is owed.
      const live = this._chatId === chatId;
      const text = live ? this._serialize() : captured;
      if (live && text === this._bagSerialized) return true;
      if (!text) return false;
      const payload = text === "{}" ? null : JSON.parse(text);
      try {
        await PF.api.patchMetadata(chatId, { [QUARANTINE_KEY]: payload });
        if (live && gen === (PF.save?._gen ?? 0)) this._bagSerialized = text;
        // Settled — but only for the bytes we actually wrote. A put() that landed
        // while this PATCH was in flight has already put NEWER bytes in the map
        // and queued its own write to clear them; deleting unconditionally here
        // would drop the record of a write that has not happened yet.
        if (this._unsettled.get(chatId) === text) this._unsettled.delete(chatId);
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
