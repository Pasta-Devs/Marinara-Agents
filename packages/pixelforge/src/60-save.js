// ── Persistence ───────────────────────────────────────────────────────────────
// Two-tier, engine-version adaptive:
//   routes mode (engine #5102+) — GET/PUT /api/game/:chatId/experience-state is
//     the AUTHORITY: rows anchor to the visible message, so swipes, branches,
//     and checkpoint loads rewind the world with the story. checkRewind() polls
//     on each finished turn and rebuilds the sim when the server state moved
//     under us. Metadata stays a write-through cache (instant synchronous boot
//     + fallback if the chat later opens on an older engine).
//   metadata mode (older engines) — the Phase-1 behavior: one small `pixelforge`
//     key via the queued PATCH route, with the documented limitation that
//     timeline seams do not rewind it.
// Both: debounced, event-driven, flushed with keepalive on teardown — never
// per-frame (Android whole-blob-rewrite shape, exploration R11/R28).

// The envelope keys THIS build understands. Anything else on a restored save
// was written by a NEWER build: simFromSaved parks it on sim._envelopeExtra and
// snapshot() re-emits it. Without that, round-tripping a chat through an older
// client is data-destructive — the older read drops the fields on the floor and
// the very next flush overwrites the row without them (plan §Q1, additive-only
// by policy). Additions to the snapshot literal below MUST be added here too.
const ENVELOPE_KEYS = new Set([
  "v",
  "chatId",
  "seed",
  "theme",
  "zone",
  "x",
  "y",
  "facing",
  "clockMin",
  "day",
  "bindings",
  "intro",
  "player",
]);

// The chat-metadata key a corrupt route row's raw text is parked in before the
// repairing write replaces it (plan §Q2 row 1, Engine #5407). Bounded hard: this
// is evidence for a bug report, not a backup — the row it came from is already
// unreadable by every means the client has.
const CORRUPT_EXCERPT_KEY = "pixelforgeCorruptExcerpt";
const CORRUPT_EXCERPT_CHARS = 4_096;
// How long a successful ladder check stays authoritative. One debounce window:
// the pre-check exists so a PUT never lands on a row it has not looked at, and
// a check taken inside the window the write was scheduled in has looked at it.
const CHECK_FRESH_MS = 2500;

// OUR top-level chat-metadata key. Named rather than spelled out at each site
// because #5406 keys its write-ordinal mirror by it: the engine stamps
// `metadata[ORDINAL_MIRROR_KEY][SAVE_META_KEY]` with the ordinal of the last write
// that actually MOVED this cache, and that number is what orders the two stores.
// A drifting literal here would silently read an ordinal for a key nobody writes.
const SAVE_META_KEY = "pixelforge";
const ORDINAL_MIRROR_KEY = "metadataWriteOrdinals";

/** A USABLE write ordinal (#5406). The engine allocates positive safe integers and
 *  reports `null` for rows written before the feature, so everything else — null,
 *  absent, zero, a float, a string — is "unorderable" and every consumer below
 *  falls back to the byte ladder. Deliberately the same validation the server's own
 *  mirror reader applies: a client that accepted a value the server ignores would
 *  order its writes against a number nothing else agrees with. */
const ordinalOf = (value) => (typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null);

/** The row's `schemaVersion` column (#5102), validated exactly the way the route's
 *  own schema validates it: an integer in [1, 1,000,000]. Everything else —
 *  absent (a pre-slice-8 reader's body), `null` (the GET's no-row shape), a float,
 *  a string — is "the row does not say", and every reader treats that as no
 *  corroboration rather than as a claim. */
const schemaVersionOf = (value) =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= 1_000_000 ? value : null;

// Sealed briefs this session stored, by chat id (plan §Q3, "sealed-brief in-memory
// cache on read and write sides"). Bounded: a brief is a few KB and a long session
// can visit many chats, so the oldest entry goes rather than the map growing.
const BRIEF_CACHE_MAX = 8;

// The ladder's rows and what each one MEANS at each site (plan §Q2). A table
// rather than a switch in three places: the whole finding behind slice 4 is that
// the sites disagreed about rows nobody had written down.
//   adopt  — boot-time probe:  metadata | repair | ignore | first-write | rebuild | reread | none
//   rewind — turn-edge check:  ignore | latch | rewind | reread | none
//   flush  — the write site:   proceed | block | fresh (proceed only while the
//                              last successful check is inside the window)
// `anchorCache` says whether the row may become _serverSerialized. Rows 1 and 2
// must never: a damaged row and a retired game's row are both things we are
// about to overwrite, and treating either as "what the server holds" would make
// the next honest difference look like a rewind.
const LADDER = Object.freeze({
  0: { name: "unavailable", adopt: "metadata", rewind: "none", flush: "proceed", anchorCache: false, toast: null },
  1: {
    name: "unparseable",
    adopt: "repair",
    rewind: "ignore",
    flush: "proceed",
    anchorCache: false,
    toast: "This world's saved row was damaged. It is being written fresh.",
  },
  2: { name: "foreign-game", adopt: "ignore", rewind: "ignore", flush: "proceed", anchorCache: false, toast: null },
  3: { name: "first-write", adopt: "first-write", rewind: "none", flush: "proceed", anchorCache: false, toast: null },
  4: {
    name: "lost-row",
    adopt: "first-write",
    rewind: "reread",
    flush: "block",
    anchorCache: false,
    toast: "The world rewound with the story.",
  },
  5: { name: "own-commit", adopt: "ignore", rewind: "ignore", flush: "proceed", anchorCache: false, toast: null },
  6: {
    name: "differs-unanchored",
    adopt: "rebuild",
    rewind: "latch",
    flush: "proceed",
    anchorCache: true,
    toast: null,
    // `toast` is what a REWIND CHECK says; `adoptToast` is what BOOT says, and
    // they differ on exactly this row (plan §Q2a: "the route row always wins at
    // adopt, and the player is told"). A row-6 difference found mid-session is
    // latched in silence — nothing visibly changed. The same row at boot means
    // the world the metadata just built is being replaced under them, which is
    // the one time they need the sentence.
    adoptToast: "The world rewound with the story.",
  },
  7: {
    name: "differs-anchored",
    adopt: "rebuild",
    rewind: "rewind",
    flush: "block",
    anchorCache: true,
    toast: "The world rewound with the story.",
    adoptToast: "The world rewound with the story.",
  },
  8: { name: "same", adopt: "none", rewind: "latch", flush: "proceed", anchorCache: true, toast: null },
  9: { name: "get-failed", adopt: "none", rewind: "none", flush: "fresh", anchorCache: false, toast: null },
});

// Process-monotonic write sequence, deliberately NOT reset per chat. Every one
// of OUR completed PUTs bumps it; a GET records the value it was issued at. A
// response still in flight across our own write read a row that predates the
// one we just wrote, so adopting it as authority would rewind the world to a
// state we ourselves superseded. Infrastructure for the decision ladder
// (plan §Q2) — checkRewind is its one consumer today, more arrive with it.
let _writeSeq = 0;

// Retry backoff for a transient write failure. Today a failed PUT waits for
// some UNRELATED future dirty event (a turn edge, a zone change, 30s of
// walking) — and in a quiet moment there is no such event, so the write is
// simply lost with a console warning. The ladder is bounded: after the last
// rung the session falls back to exactly that trigger-driven behavior rather
// than polling a dead server forever.
const FLUSH_BACKOFF_MS = [2500, 5000, 10_000, 30_000, 60_000];
const FLUSH_BACKOFF_GIVEUP = 8;
// WALL 1, and it is the ORDINARY path's only one: the Engine's per-row ceiling.
// The route 422s above 262,144 chars, so this mirrors it exactly — the local
// pre-flight exists to keep that 422's retry loop unreachable and for no other
// reason. It was 32,768 (maintainer ruling, round 2: inherited caution from a
// mobile-payload worry, the same one that shrank the player caps), which refused
// perfectly savable worlds and degraded the session permanently for doing it.
const MAX_SNAPSHOT_CHARS = 262_144;
// WALL 2, and it is REAL but narrow: it binds the pagehide TEARDOWN path only.
// Teardown sends a PAIR of keepalive requests in routes mode, and the Fetch
// standard caps TOTAL in-flight keepalive body bytes at 64 KiB (65,536) per
// origin — the whole pair against one quota, not one allowance each. So the
// teardown wall is 2 × the UTF-8 byte length of the snapshot, plus the two JSON
// wrappers (`{"state":…}` and `{"pixelforge":…}`, ~26 bytes together) and
// whatever else the page has in flight at unload. 57,000 leaves ~8.5 KB of that
// headroom. This is a browser constraint, not a policy, and it is why an
// ordinary flush and a teardown flush are bounded by different numbers: an
// ordinary flush is bounded by the server cap alone.
const KEEPALIVE_PAIR_BUDGET_BYTES = 57_000;
// Re-probe cadence while a probe FAILURE pinned the session to metadata mode
// (plan §Q2a): a transient 500 at boot otherwise costs timeline rewind for the
// entire session, because adopt() short-circuits on mode !== null forever.
const REPROBE_INTERVAL_MS = 60_000;
// …and the cadence is bounded for the same reason the write ladder is: a route
// that has answered wrong eight times running is not coming back inside this
// session, and a minute-timer asking forever is a background request leak.
const REPROBE_GIVEUP = 8;

PF.save = {
  _timer: 0,
  /** The debounce and the retry ladder share _timer (a busy player must not be
   *  able to reset a backoff to 2.5s on every zone change). This says which of
   *  the two the live timer is, so a flush from any other trigger can decline to
   *  cancel a rung: the ladder has to measure ELAPSED time, not requested time. */
  _timerIsBackoff: false,
  _lastSerialized: null,
  _flushChain: null,
  /** The next write goes up whatever the dedupe caches say, and only the write
   *  that CONSUMES it clears it. Promotion out of a pinned metadata session sets
   *  it: `_lastSerialized = null` alone is undone by any flush already parked in
   *  an await, which then reassigns the cache and cancels the promotion's first
   *  write with no trace. */
  _forceWrite: false,
  /** null until adopt() probes; then "routes" | "metadata". */
  mode: null,
  /** Serialized last-known server-side route state (ours or adopted). */
  _serverSerialized: null,
  _rewindCheckInFlight: false,
  /** Consecutive transient write failures; any success resets it. */
  _flushFailures: 0,
  /** A terminal write refusal (too large): mutations continue in memory, but
   *  nothing re-arms. Cleared by the next write that actually lands. */
  degraded: false,
  _degradeToasted: false,
  /** Metadata mode was forced by a FAILURE, not by a 404/409 mode signal —
   *  so it is worth re-probing. A genuine "no routes here" never pins. */
  _probePinned: false,
  _reprobeTimer: 0,
  _reprobeInFlight: false,
  _reprobedAfterFlush: false,
  /** Consecutive failed re-probes; bounded by REPROBE_GIVEUP. */
  _reprobeFailures: 0,
  /** The envelope-key registry, exposed so the completeness assertion below and
   *  the harness can check the list against what snapshot() actually emits. */
  _envelopeKeys: ENVELOPE_KEYS,
  /** #5406: the ordinal the engine gave OUR last successful route write on this
   *  chat, straight off the PUT echo. Per-chat, so reset() clears it. */
  _putOrdinal: null,
  /** One-shot per chat: whether a row has already been seen whose out-of-band
   *  `schemaVersion` disagreed with the block inside it (S5 slice 8). Said once,
   *  because it is a fact about how the row was WRITTEN and repeating it every
   *  turn edge would be noise. */
  _schemaVersionNoted: false,
  /** THE LOADING GATE (plan §Q3b, maintainer ruling #7). null while the chat plays;
   *  otherwise `{ chatId, state: "generating" | "failed", attempts }`.
   *
   *  A generate-configured chat does NOT enter play until its brief is sealed. The
   *  ruling that produced this is worth restating where the flag lives, because the
   *  alternative it replaced looked cheaper: a player must never invest in a world
   *  that is going to be discarded, so there is no interim playable world any more
   *  and a long loading screen is the accepted cost. While the gate holds, the sim
   *  does not step, no mutator resolves, and nothing — debounce, chat-switch
   *  capture, detach, pagehide — writes a save.
   *
   *  Chat-scoped by construction (reset() clears it) AND by the id it carries, so a
   *  stale async completion cannot lift or fail the gate of the chat you arrived at. */
  gate: null,
  /** Chat ids with a generation call in flight. A SET, not a flag: leaving a chat
   *  mid-generation must neither abandon that call (it still seals, and the cache
   *  below carries it) nor block the chat you arrive at from starting its own. */
  _generating: new Set(),
  /** chatId → sealed brief, for the gate's escape-safety. A generation that lands
   *  while the player is in ANOTHER chat cannot patch that chat's host.chatMeta, so
   *  without this, coming back reads a meta that still looks unsealed and generates
   *  the world a SECOND time — a wasted host call and a different world. */
  _briefCache: new Map(),
  /** The subset of `_briefCache` whose chat metadata has SINCE been observed to
   *  carry the sealed brief itself. Those entries are the only ones the cache may
   *  evict: past that point the metadata knows, and the cache is a convenience.
   *  An entry that is NOT in here is the only witness there is (see _cacheBrief). */
  _briefSeenInMeta: new Set(),

  /** Reads core.sim and core.chatId and NOTHING else: 80-setup calls this with
   *  a synthetic two-key core, and reaching for core.host/hud/render there
   *  throws inside the wizard's launch handler.
   *
   *  `dropCarry` is the pre-flight fallback (see _snapshotWithoutCarry): the
   *  same snapshot with a newer build's unreadable block left out. */
  snapshot(core, dropCarry) {
    const sim = core.sim;
    if (!sim) return null;
    // Unknown keys FIRST, known keys assigned over them: a newer build's field
    // rides through untouched but can never shadow one of ours. The property
    // that matters is DETERMINISM, not alphabetical order — the flush dedupe,
    // the adopt comparison, and the rewind comparison are all string equality
    // over JSON.stringify, so any order that drifted with the source would forge
    // both spurious saves and spurious "The world rewound with the story."
    // toasts. Sorting is simply the cheapest order that cannot drift.
    const snap = {};
    const extra = dropCarry ? null : sim._envelopeExtra;
    if (extra) {
      for (const key of Object.keys(extra).sort()) {
        if (extra[key] === undefined) continue; // JSON.stringify would drop it anyway
        snap[key] = extra[key];
      }
    }
    snap.v = 1;
    snap.chatId = core.chatId;
    snap.seed = sim.world.seed;
    snap.theme = sim.world.theme;
    snap.zone = sim.zoneId;
    snap.x = Math.round(sim.x);
    snap.y = Math.round(sim.y);
    snap.facing = sim.facing;
    snap.clockMin = sim.clockMin;
    snap.day = sim.day;
    snap.bindings = sim.world.bindings;
    // §7 one-shot injection flags: persisted so a reload never re-taxes the
    // GM context with prose that already lives in chat history.
    snap.intro = sim.intro ?? { world: false, zones: {}, npcs: {} };
    // The S5 player block, and it is emitted UNCONDITIONALLY like every line
    // above it — no `if (sim.player)`, no "only when it has something in it".
    // A key that is listed in ENVELOPE_KEYS but only SOMETIMES emitted is worse
    // than one missing from the list: the list makes simFromSaved skip it on the
    // way in, so it never reaches _envelopeExtra either, and the write silently
    // deletes a newer build's field. That is the exact slice-1 failure, rebuilt
    // one branch at a time. serialize() takes an absent block and hands back the
    // default one, which is what makes the unconditional emission possible on
    // the synthetic cores 80-setup and the load-time assertion build.
    // `dropCarry` is threaded DOWN into the block serializer as well: since the
    // block keeps a newer build's unknown player-level keys too (58-player
    // PLAYER_KEYS), a pre-flight that shed only the envelope's carry would leave
    // an arbitrarily large foreign field inside `player` with no escape hatch.
    snap.player = PF.player.serialize(sim.player, dropCarry);
    return snap;
  },

  /** Where /game/create actually stores the wizard config (review finding):
   *  the chooser wraps our cfg as setupConfig.experienceConfig = cfg, and the
   *  server persists the whole setupConfig under meta.gameSetupConfig — so our
   *  own `experienceConfig.seed` lands two levels deep. Read every plausible
   *  depth so a future un-nesting doesn't strand old games. */
  _configSeed(meta) {
    const setup =
      meta && typeof meta.gameSetupConfig === "object" && meta.gameSetupConfig !== null ? meta.gameSetupConfig : null;
    const outer =
      setup && typeof setup.experienceConfig === "object" && setup.experienceConfig !== null
        ? setup.experienceConfig
        : null;
    const inner =
      outer && typeof outer.experienceConfig === "object" && outer.experienceConfig !== null
        ? outer.experienceConfig
        : null;
    for (const candidate of [inner?.seed, outer?.seed]) {
      if (typeof candidate === "number") return candidate >>> 0;
    }
    return null;
  },

  /** Restore a saved state into a freshly built world. Returns the sim.
   *
   *  The one place the quarantine bag is hydrated (plan §Q1a). Deliberately not
   *  simFromSaved, which also runs on every _rebuild: re-reading the key there
   *  would resurrect a slot a version re-adoption had just consumed, and the
   *  re-adoption would then run again on the same boot. */
  restore(meta, chatId) {
    const saved =
      meta && typeof meta[SAVE_META_KEY] === "object" && meta[SAVE_META_KEY] !== null ? meta[SAVE_META_KEY] : null;
    PF.quarantine.hydrate(meta, chatId);
    return this.simFromSaved(saved, meta, chatId);
  },

  /** The sealed world brief. Primary home: the TOP-LEVEL pixelforgeBrief
   *  metadata key (atomic under the queued shallow-merge PATCH — no
   *  read-modify-write of the whole setup config). The nested config location
   *  remains readable for chats sealed before the key moved. Absent on
   *  pre-0.4.0 games → legacy layout. */
  _configBrief(meta, chatId) {
    const top =
      meta && typeof meta.pixelforgeBrief === "object" && meta.pixelforgeBrief !== null ? meta.pixelforgeBrief : null;
    if (top && Array.isArray(top.cast)) return this._metaKnows(chatId, top);
    if (top) return null; // a {skipped:true} marker: generation declined, stay legacy
    const setup =
      meta && typeof meta.gameSetupConfig === "object" && meta.gameSetupConfig !== null ? meta.gameSetupConfig : null;
    const outer =
      setup && typeof setup.experienceConfig === "object" && setup.experienceConfig !== null
        ? setup.experienceConfig
        : null;
    const inner =
      outer && typeof outer.experienceConfig === "object" && outer.experienceConfig !== null
        ? outer.experienceConfig
        : null;
    for (const candidate of [inner?.brief, outer?.brief]) {
      if (candidate && typeof candidate === "object" && Array.isArray(candidate.cast))
        return this._metaKnows(chatId, candidate);
    }
    // …and LAST, this session's own cache (see _briefCache). Only when the metadata
    // carries nothing at all about a brief: anything the host actually delivered —
    // a sealed brief or a `{skipped:true}` marker — is the newer truth and both
    // return above, so the cache can never shadow the stored answer.
    const cached = chatId ? this._briefCache.get(chatId) : null;
    return cached && Array.isArray(cached.cast) ? cached : null;
  },

  /** The metadata was just read carrying this chat's sealed brief, so the cache
   *  entry for it (if any) has stopped being the only witness. Recorded so the
   *  eviction below has something safe to drop. Returns the brief, so the reader
   *  above stays one expression. */
  _metaKnows(chatId, brief) {
    if (chatId && this._briefCache.has(chatId)) this._briefSeenInMeta.add(chatId);
    return brief;
  },

  /** Remember a brief we just sealed, newest last, bounded.
   *
   *  EVICTION IS NOT FREE HERE, which is why this is not a plain drop-the-oldest.
   *  Until the host's chatMeta comes back carrying the sealed key, this cache is
   *  the ONLY thing that knows the chat is sealed — case (as): a generation that
   *  lands while the player is in another chat cannot patch the metadata blob they
   *  are holding, so the next visit reads a chat that still looks unsealed. Drop
   *  that entry and the gate re-arms, a second host call runs, and the player gets
   *  a DIFFERENT world than the one already stored. So only entries the metadata
   *  has been observed to carry are droppable; when none of them is, the cache
   *  carries the overflow rather than the loss. What it is really bounded by is
   *  how many chats one session can have sealed-but-not-yet-acknowledged at once,
   *  which is a handful of a few KB each.
   *
   *  PF.quarantine's `_unsettled` map answers the identical fork identically, and
   *  the two are deliberately aligned (O-2): both are per-session maps of small
   *  byte strings in which each entry is the sole record of something a later
   *  visit needs, so a ceiling that can only be met by dropping one of those is
   *  not a ceiling either of them meets. */
  _cacheBrief(chatId, sealed) {
    if (!chatId || !sealed || !Array.isArray(sealed.cast)) return;
    this._briefCache.delete(chatId);
    this._briefSeenInMeta.delete(chatId);
    this._briefCache.set(chatId, sealed);
    while (this._briefCache.size > BRIEF_CACHE_MAX) {
      let dropped = null;
      for (const key of this._briefCache.keys()) {
        if (this._briefSeenInMeta.has(key)) {
          dropped = key;
          break;
        }
      }
      if (dropped === null) break;
      this._briefCache.delete(dropped);
      this._briefSeenInMeta.delete(dropped);
    }
  },

  /** "This chat was configured to generate a world and has not sealed one yet."
   *  ONE predicate with FOUR consumers that used to be copies of the same
   *  expression: the interim world mark, the stamp-evaluability gate, the
   *  loading gate, and maybeGenerateBrief's nothing-to-generate branch. Separate
   *  copies of a predicate this load-bearing is how the gate and the interim mark
   *  come to disagree about which chats are which. */
  briefExpected(meta, chatId) {
    return !this._configBrief(meta, chatId) && meta?.pixelforgeBrief === undefined && this._configGenerate(meta);
  },

  /** The wizard's opt-in for surface-side world generation (0.4.0 chats). */
  _configGenerate(meta) {
    const setup =
      meta && typeof meta.gameSetupConfig === "object" && meta.gameSetupConfig !== null ? meta.gameSetupConfig : null;
    const outer =
      setup && typeof setup.experienceConfig === "object" && setup.experienceConfig !== null
        ? setup.experienceConfig
        : null;
    const inner =
      outer && typeof outer.experienceConfig === "object" && outer.experienceConfig !== null
        ? outer.experienceConfig
        : null;
    return inner?.generate === true || outer?.generate === true;
  },

  /** Arm the loading gate for a chat whose brief is not sealed yet, and answer
   *  whether it holds. Called ONCE per chat switch and BEFORE adopt(), because
   *  adopt's row-3 branch is "first-write" — a probe of a gated chat would write
   *  the un-entered world up as if it were somebody's play.
   *
   *  Legacy and non-generate chats (default worlds by design) never arm it and
   *  play immediately; so does a chat whose generation was declined, whose
   *  `{skipped:true}` marker briefExpected() reads as "sealed enough". */
  armGate(core, meta) {
    if (!core?.chatId || !this.briefExpected(meta, core.chatId)) {
      this.gate = null;
      // THE STARTING PURSE IS A PROPERTY OF STATE, NOT OF AN INSTANT (slice 6).
      // It used to be paid at exactly ONE moment — the tail of the generation
      // that sealed the brief — and every ordinary way of not being there for
      // that moment cost it permanently: leaving the chat while generation ran
      // (the seal lands with the player elsewhere and the chat fence returns
      // before the grant), a reload between the seal and the lift, or a throw
      // that turned the lift into a retry screen. Sealed worlds are also the only
      // ones that get one, which is what keeps this off every legacy save in the
      // wild: a default world is not a world beginning, it is the world that has
      // always been there. grantStartingPurse is idempotent by its own predicate,
      // so a chat that has already been paid is untouched by this second call.
      if (core?.chatId && core.sim?.world && !core.sim.world.interim && this._configBrief(meta, core.chatId))
        PF.economy.grantStartingPurse(core);
      return false;
    }
    this.gate = { chatId: core.chatId, state: "generating", attempts: 0 };
    return true;
  },

  /** Does the gate hold for THIS core's chat? Every refusal below asks this and
   *  not `gate !== null`: a gate armed for the chat we left must not silence the
   *  chat we arrived at, and reset() is not the only ordering that can leave the
   *  two out of step (an async completion can land between the two). */
  gateHolds(core) {
    return this.gate !== null && !!core && this.gate.chatId === core.chatId;
  },

  /** The brief sealed: play begins. adopt() runs HERE rather than at the chat
   *  switch, because it is the first thing allowed to write.
   *
   *  AND IT REFUSES TO LIFT ONTO AN INTERIM WORLD. The gate's whole promise is
   *  that nobody plays a world that is going to be discarded, and the placeholder
   *  is exactly that world: everything done in it stamps {briefHash:0, interim:1}
   *  and is severed unrecoverably the moment the real world compiles. Every
   *  caller's job is therefore to REBUILD first and lift second; this is the
   *  assertion that keeps a future caller from quietly re-opening the hole. */
  _liftGate(core) {
    if (!this.gateHolds(core)) return;
    if (core.sim?.world?.interim) {
      console.warn("[pixelforge] refusing to start play in the placeholder world; the gate stays up");
      return;
    }
    this.gate = null;
    core.hud?.update?.();
    void this.adopt(core);
  },

  /** Everything that happens once a sealed brief is IN HAND: compile the world it
   *  describes, carry across what crosses this seam, lift the gate, pay the purse.
   *
   *  Factored out of maybeGenerateBrief's success tail because it has a SECOND
   *  caller, and the absence of that second caller was the bug. Every throw the
   *  generation guard was written for lands AFTER the brief is stored and cached —
   *  the compile, the transplant, the park are all downstream — so by the time the
   *  player presses "Try again", briefExpected() is already false and the retry
   *  takes the nothing-to-generate branch. That branch used to lift the gate bare,
   *  which started play IN THE PLACEHOLDER: adopt's first-write wrote it up, and
   *  everything played there was severed the next time the real world compiled.
   *  A retry recompiles from the brief that is already sealed instead. */
  _installSealedWorld(core, chatId, sealed, seed, theme) {
    // Under the gate the sim standing here is a placeholder nobody walked in, so
    // this is a plain replacement — but the envelope carry is NOT play state (it
    // is a newer build's fields) and rides across regardless, exactly as it does
    // through _rebuild.
    const carriedExtra = core.sim?._envelopeExtra;
    // The player block crosses the same seam, and it crosses SPLIT (plan §Q5).
    // THE GATE MAKES THIS PATH A COMPAT SHIM, NOT THE NORMAL ONE, and it stays
    // for two reasons the gate cannot cover: a chat CREATED BEFORE the gate
    // shipped has a real interim save with real play in it, and a legacy save
    // can arrive stamped for a world that never sealed. For those, world-free
    // fields — the purse, the skills, the board's completion counts — mean the
    // same thing in the compiled world, and everything world-bound belonged to
    // the throwaway one and goes to the stamp slot instead of being silently
    // reinterpreted against people who do not exist here. For a gated chat the
    // block is a fresh default and the split moves nothing, which is the point:
    // the safety net costs nothing when the gate has already done its job.
    const carriedPlayer = core.sim?.player;
    core.sim = new PF.Sim(PF.world.build(seed, theme, sealed));
    if (carriedExtra) core.sim._envelopeExtra = carriedExtra;
    const moved = PF.player.transplant(carriedPlayer, core.sim.world, sealed);
    core.sim.player = moved.player;
    if (moved.severed) this._park(chatId, moved.severed.slot, moved.severed.entry);
    this._lastSerialized = null;
    core.render?.clearZones?.();
    void PF.assets.load(core);
    // The gate lifts BEFORE the first dirty flag, and the order is load-bearing:
    // markDirty refuses while the gate holds, so arming the save first would
    // arm nothing and the freshly compiled world would wait for some unrelated
    // later event to be written at all.
    this._liftGate(core);
    // S3's starting purse, at the one moment that is unambiguously "this world
    // begins now" and after the lift, because it goes through the mutators the
    // gate was refusing a line ago (PF.economy.grantStartingPurse says why this
    // moment and not a default on the block). armGate pays the same debt on every
    // boot path that never reaches here — and applies the same test: SEALED
    // worlds only. A skipped marker reaches this tail with `sealed` null and a
    // themed default under it, and a default world is not a world beginning — it
    // is the world that has always been there, which is what keeps the purse off
    // every declined and legacy chat alike (armGate's own guard already pays
    // those nothing; two chats on the identical default world must hold the
    // same money).
    if (sealed) PF.economy.grantStartingPurse(core);
    core.hud?.refreshChips();
    core.hud?.toast("The world takes shape.");
    this.markDirty(core);
  },

  /** Generation did not seal. The chat stays UNSEALED — which is the whole
   *  no-bricked-chat argument: nothing was written, so the next visit arms the
   *  gate again and tries again on its own, and no default world was ever sealed
   *  on a detail-heavy player's behalf. NO failure seals one now, deterministic
   *  ones included (18-brief `generate`'s design revision).
   *
   *  `kind` is the ladder's own verdict, carried onto the gate so the retry screen
   *  can say something truer than "something went wrong": a busy engine and a
   *  refused request are the same screen but not the same sentence, and a
   *  deterministic 400 that reads as a mystery is a player pressing a button that
   *  will never work. Absent for the throw path, which has no verdict to report. */
  _failGate(core, kind) {
    if (!this.gateHolds(core)) return;
    this.gate = {
      ...this.gate,
      state: "failed",
      attempts: this.gate.attempts + 1,
      failure: typeof kind === "string" && kind ? kind : null,
    };
    core.hud?.update?.();
  },

  /** ONE SENTENCE FOR THE RETRY SCREEN, per failure kind, and it lives here
   *  rather than in 70-hud for the reason every other decision in this module
   *  does: the HUD needs a DOM and the harness has none, so a string the player
   *  reads would be the one part of the screen nothing could pin.
   *
   *  The kinds are the ladder's own (18-brief `generate`'s `onFailure`) plus
   *  "storage", which is this module's — the brief generated fine and the PATCH
   *  that would have stored it did not. "refused" is the one that earns its own
   *  sentence: a deterministic 400/422 gives the same answer every time, and a
   *  player pressing a button that will never work deserves to be told so.
   *  Unknown or absent kinds fall back to the honest generic — a throw has no
   *  verdict to report, and a kind a newer ladder invents must not blank the
   *  panel. */
  gateReason(kind) {
    switch (kind) {
      case "refused":
        return "The request was turned down rather than delayed, so another attempt may well get the same answer; a shorter, plainer setting description is the likeliest thing to change it.";
      case "unavailable":
        return "The engine could not take the request just now — it may be busy with something else.";
      case "network":
        return "The request did not get through.";
      case "timeout":
        return "It was taking longer than the time set aside for it.";
      case "storage":
        return "The world was written, but saving it to this chat did not go through.";
      default:
        return "Something went wrong partway through.";
    }
  },

  /** The retry the gate's failure state offers, and the only caller is that
   *  button: everything else re-arms by revisiting the chat. */
  retryGeneration(core) {
    if (!this.gateHolds(core) || this.gate.state !== "failed") return false;
    this.gate = { ...this.gate, state: "generating", failure: null };
    core.hud?.update?.();
    void this.maybeGenerateBrief(core);
    return true;
  },

  /** Surface-side world generation (spec §5, amended by plan §Q3b): BLOCKING now,
   *  behind the loading gate. The old contract booted the chat on a throwaway
   *  themed world and generated behind a toast; the maintainer rejected that
   *  outright (ruling #7) — a player must never invest in a world that is going to
   *  be discarded. So the gate holds play, this runs the one #5135 call behind it
   *  with the retry/salvage ladder 0.4.0 already shipped, the sealed brief stores
   *  atomically under pixelforgeBrief (3 retries), the world compiles, and the gate
   *  lifts. On failure the gate offers retry and the chat stays unsealed.
   *
   *  Runs at most once per chat AT A TIME, and the set is keyed by chat id rather
   *  than being one flag: with a flag, leaving a chat mid-generation left the flag
   *  up, and the chat you arrived at returned here immediately and sat behind a
   *  gate with nothing running behind it. The stored key (sealed brief or a skipped
   *  marker) remains the one-shot guard ACROSS visits, so completed chats and
   *  pre-0.4.0 chats never re-generate. */
  async maybeGenerateBrief(core) {
    const chatId = core.chatId;
    if (!chatId || this._generating.has(chatId)) return;
    const meta =
      core.host && typeof core.host.chatMeta === "object" && core.host.chatMeta !== null ? core.host.chatMeta : {};
    if (!this.briefExpected(meta, chatId)) {
      // Nothing to generate. A gate armed against a metadata blob that has since
      // caught up (or against this session's own cache) lifts here rather than
      // waiting for a generation call that would find nothing to do.
      //
      // …but the world standing under that gate is the PLACEHOLDER, built when
      // the brief was still expected, and lifting onto it is what turned a
      // post-seal throw into a chat whose play was severed the next time the real
      // world compiled. THIS IS ALSO THE RETRY PATH: every throw the guard below
      // catches lands after the brief is stored and cached, so "Try again" always
      // arrives here rather than at a second generation call. Recompile from the
      // brief that is already sealed, then lift onto THAT. `_configBrief` is null
      // only when the chat stopped expecting one for a reason other than a seal (a
      // `{skipped:true}` marker landing mid-gate), and build() answers that with
      // the themed default world the marker asked for.
      if (this.gateHolds(core) && core.sim?.world?.interim) {
        const theme = this._configTheme(meta) ?? "cozy-village";
        let seed = this._configSeed(meta);
        if (seed === null) seed = PF.hashStr(String(chatId));
        this._installSealedWorld(core, chatId, this._configBrief(meta, chatId), seed, theme);
        return;
      }
      this._liftGate(core);
      return;
    }
    this._generating.add(chatId);
    try {
      const theme = this._configTheme(meta) ?? "cozy-village";
      let seed = this._configSeed(meta);
      if (seed === null) seed = PF.hashStr(String(chatId));
      const setup = meta.gameSetupConfig && typeof meta.gameSetupConfig === "object" ? meta.gameSetupConfig : {};
      const preferences = [
        setup.setting ? `Setting: ${setup.setting}` : "",
        setup.tone ? `Tone: ${setup.tone}` : "",
        setup.difficulty ? `Difficulty: ${setup.difficulty}` : "",
        setup.rating ? `Rating: ${setup.rating}` : "",
      ]
        .filter(Boolean)
        .join("\n");
      let failure = null;
      const sealed = await PF.brief.generate(chatId, {
        theme,
        seed,
        preferences,
        onFailure: (kind) => {
          failure = kind;
        },
      });
      if (!sealed) {
        // EVERY failure — a busy engine, the network, the budget timeout, a route
        // that is not there, and now a deterministic 400 or 422 as well: do NOT
        // seal. The key stays absent, this visit offers retry, and the next visit
        // arms the gate again. There is deliberately no "play the default world"
        // escape on any branch: sealing a default world for a player who wrote
        // three paragraphs of setting is the outcome ruling #7 exists to forbid,
        // and a deterministic failure is the one case they could never undo.
        if (chatId === core.chatId) this._failGate(core, failure);
        return;
      }
      let stored = false;
      for (let attempt = 0; attempt < 3 && !stored; attempt++) {
        try {
          await PF.api.patchMetadata(chatId, { pixelforgeBrief: sealed });
          stored = true;
        } catch (err) {
          if (attempt === 2) console.warn("[pixelforge] brief storage failed; the chat stays unsealed", err);
          else await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
        }
      }
      if (!stored) {
        if (chatId === core.chatId) this._failGate(core, "storage");
        return;
      }
      // Cached BEFORE the chat fence below, and that ordering is the gate's
      // escape-safety: a generation that lands while the player is in another chat
      // returns here, and the cache is the only thing that will tell the next visit
      // this world is already sealed rather than generating it a second time.
      this._cacheBrief(chatId, sealed);
      if (chatId !== core.chatId) return;
      // Build the world the brief describes, lift onto it, pay the purse. Shared
      // with the retry path above, which is how a throw out of any of it stays
      // recoverable instead of stranding the player in the placeholder.
      this._installSealedWorld(core, chatId, sealed, seed, theme);
    } catch (err) {
      // NEVER A SPINNER WITH NOTHING BEHIND IT. Every failure the generation
      // ladder KNOWS about is already a `null` seal handled above; this is the
      // one it does not — a throw out of the compile, the transplant or the
      // park, which before this left the gate reading "writing your world…"
      // forever with no call running and no button to press. A retry screen is
      // the right answer to an unexpected throw for the same reason it is the
      // right answer to a refused generation: nothing was sealed, so the chat is
      // untouched and trying again is free.
      console.warn("[pixelforge] world generation failed unexpectedly; the chat stays unsealed", err);
      if (chatId === core.chatId) this._failGate(core);
    } finally {
      this._generating.delete(chatId);
    }
  },

  /** The wizard's theme, from the same double-nested config home as the seed. */
  _configTheme(meta) {
    const setup =
      meta && typeof meta.gameSetupConfig === "object" && meta.gameSetupConfig !== null ? meta.gameSetupConfig : null;
    const outer =
      setup && typeof setup.experienceConfig === "object" && setup.experienceConfig !== null
        ? setup.experienceConfig
        : null;
    const inner =
      outer && typeof outer.experienceConfig === "object" && outer.experienceConfig !== null
        ? outer.experienceConfig
        : null;
    for (const candidate of [inner?.theme, outer?.theme]) {
      if (typeof candidate === "string" && candidate) return candidate;
    }
    return null;
  },

  /** Build a sim from a save object (route state or the metadata key). */
  simFromSaved(saved, meta, chatId) {
    // Explicit null checks: 0 is a legitimate seed, so truthiness chaining would
    // silently rebuild a zero-seeded world from the wrong source.
    let seed = saved && typeof saved.seed === "number" ? saved.seed >>> 0 : null;
    if (seed === null) seed = this._configSeed(meta);
    if (seed === null) seed = PF.hashStr(String(chatId));
    // Saved theme wins (it is what the world was built with), then the wizard
    // config; build() validates the id and falls back to the default theme.
    // The sealed brief (when present) makes build() compile the generated
    // world; the brief lives ONLY in chat metadata (pixelforgeBrief, or the
    // legacy nested config spot), never in save rows.
    const theme = (saved && typeof saved.theme === "string" ? saved.theme : null) ?? this._configTheme(meta);
    const brief = this._configBrief(meta, chatId);
    const world = PF.world.build(seed, theme, brief);
    // The pre-brief world of a generation-enabled chat is a placeholder the sealed
    // brief will replace — stamped so the World Maps export (§8) never registers
    // its zones on the user's map. A sealed brief or a {skipped:true} marker makes
    // the world final. The LOADING GATE (plan §Q3b) now keeps the player out of
    // this world entirely, so on the normal path nothing is ever played here; the
    // mark stays as the safety net it also always was — for chats created before
    // the gate shipped (whose interim saves are real), and for the window between
    // a brief sealing and the rebuild landing.
    if (this.briefExpected(meta, chatId)) world.interim = true;
    // A save row is untrusted JSON and `world.zones` is a plain object, so a
    // bare `zones[id]` truthiness test reads straight through Object.prototype.
    // Two demonstrated outcomes: `zone: "constructor"` resolves to a FUNCTION,
    // which crashes the mount the first time anything reads z.w; and a binding
    // naming "constructor" writes `spatialLocationId` onto the global Object
    // itself. Own-property only, both places.
    const hasZone = (id) => typeof id === "string" && Object.prototype.hasOwnProperty.call(world.zones, id);
    const sim = new PF.Sim(world);
    // Additive-only by policy (plan §Q1): keys a NEWER build added ride through
    // this one instead of being erased by the next flush. Collected OUTSIDE the
    // version gate deliberately — a build that cannot even parse `v` is exactly
    // the build most likely to be destroying data it does not understand.
    if (saved && typeof saved === "object") {
      const extra = {};
      for (const key of Object.keys(saved)) {
        // "__proto__" arrives as an own property from JSON.parse; assigning it
        // onto a plain object would set the prototype instead of a key.
        if (ENVELOPE_KEYS.has(key) || key === "__proto__") continue;
        if (saved[key] === undefined) continue;
        extra[key] = saved[key];
      }
      sim._envelopeExtra = extra;
    }
    // Tolerant read (plan §Q1): the old strict `saved.v === 1` half-applied a
    // forward-version save — right world (seed/theme resolve above the gate),
    // but spawn/08:00/day-1, no intro flags, no bindings. Every field below
    // carries its own type check, so a higher envelope version restores exactly
    // the fields it still shares with us.
    if (saved && typeof saved.v === "number" && saved.v >= 1) {
      // A saved zone that no longer exists (world gen changed between versions,
      // or an interior that this build no longer compiles) falls back to the
      // start zone — but the saved x/y belonged to the OLD zone, and carrying
      // them over just clamps interior coordinates into a much larger map. The
      // solid-tile rescue below only fires if that lands in a wall, so the
      // player would silently reappear in a random corner. Land them at the
      // spawn instead, which is the one tile every zone guarantees is walkable.
      const zoneResolved = hasZone(saved.zone);
      if (zoneResolved) sim.zoneId = saved.zone;
      const z = sim.zone();
      if (zoneResolved) {
        if (typeof saved.x === "number") sim.x = PF.clamp(saved.x, PF.TILE, (z.w - 1) * PF.TILE);
        if (typeof saved.y === "number") sim.y = PF.clamp(saved.y, PF.TILE, (z.h - 1) * PF.TILE);
      } else {
        sim.x = (z.spawn.x + 0.5) * PF.TILE;
        sim.y = (z.spawn.y + 0.5) * PF.TILE;
      }
      if (typeof saved.facing === "number") sim.facing = saved.facing & 3;
      if (typeof saved.clockMin === "number") sim.clockMin = PF.clamp(saved.clockMin | 0, 0, 24 * 60 - 1);
      if (typeof saved.day === "number") sim.day = Math.max(1, saved.day | 0);
      // The world was built (and everyone placed at their compiled anchor) by
      // the constructor above, which ran against the DEFAULT 08:00 clock. Now
      // that the saved time is restored, re-place for the real daypart — else a
      // chat reopened at midnight would show a town going about its morning.
      sim.resolveSchedules();
      if (saved.intro && typeof saved.intro === "object") {
        // A CLOSED LITERAL, and that is the fact this line exists to answer.
        // Every subkey not named here is stripped on every restore AND on every
        // `_rebuild`, and the envelope carry cannot cover for it: `_envelopeExtra`
        // holds unknown TOP-LEVEL keys, so a known key's unknown SUBKEY rides
        // nothing at all. Adding a field under `intro` therefore means adding it
        // HERE, in the same change, or it is write-only state.
        sim.intro = {
          world: saved.intro.world === true,
          zones: saved.intro.zones && typeof saved.intro.zones === "object" ? { ...saved.intro.zones } : {},
          npcs: saved.intro.npcs && typeof saved.intro.npcs === "object" ? { ...saved.intro.npcs } : {},
          // THE DURABLE HALF OF THE TWO-FIELD FLUSH (plan §2.5): the last day a
          // completed sleep made owed. It lives under `intro` because that key is
          // already in the envelope and a wrap-up marker is not worth an
          // ENVELOPE_KEYS entry of its own — and the whole design is void without
          // this line, since a marker that does not survive a reload can never
          // outlive the session that staged it. Read through the resolver: it
          // comes off save JSON and it is about to be compared against `sim.day`.
          ledgerOwed: PF.player.resolvedDay(saved.intro.ledgerOwed),
        };
      }
      if (saved.bindings && typeof saved.bindings === "object") {
        for (const [loc, zone] of Object.entries(saved.bindings)) {
          if (hasZone(zone)) {
            world.bindings[loc] = zone;
            world.zones[zone].spatialLocationId = loc;
          }
        }
      }
      // Unblock a save restored into a solid tile (world gen changed between versions).
      if (sim.blocked(sim.zone(), sim.x, sim.y)) {
        const spawn = sim.zone().spawn;
        sim.x = (spawn.x + 0.5) * PF.TILE;
        sim.y = (spawn.y + 0.5) * PF.TILE;
      }
    }
    // ── The player block, rehydrated in the order §Q5 fixes ───────────────────
    // parse/migrate → stamps/severance → gated dangling repair → notices. The
    // order is the whole correctness argument: a repair run before severance
    // would drop quests the severance was about to quarantine intact, and a
    // notice appended before severance would be severed along with the lines it
    // is explaining. Deliberately OUTSIDE the `saved.v` gate, like the carry
    // above it and for the same reason — `player` carries its own version and a
    // build that cannot read the envelope's is the one most likely to be
    // destroying what it does not understand.
    sim.player = this._rehydratePlayer(saved, world, brief, meta, chatId, sim);
    return sim;
  },

  /** Every quarantine write goes through here, and the point of the wrapper is
   *  the RETURN VALUE. `put` refuses — first-loss-wins on the one-shot slots, or
   *  an entry too large for the bag's own ceiling — and every caller used to
   *  discard that silently, which is how a second severance came to delete the
   *  fields it had just stripped. A refusal is now either handled by the caller
   *  or said out loud here, and never both ignored and unlogged. */
  _park(chatId, slot, entry) {
    if (PF.quarantine.put(chatId, slot, entry)) return true;
    const occupied = PF.quarantine.peek(slot) !== null;
    console.warn(
      `[pixelforge] the ${slot} quarantine slot did not take this entry: ` +
        (occupied
          ? "it already holds an earlier loss of the same kind (first-loss-wins)"
          : "the entry is larger than the bag's own ceiling"),
    );
    return false;
  },

  /** The §Q5 rehydration, factored out so the ordering is one readable list
   *  rather than a tail on a 90-line function. Never throws: every branch has a
   *  defaults boot behind it. */
  _rehydratePlayer(saved, world, brief, meta, chatId, sim) {
    const briefExpected = this.briefExpected(meta, chatId);
    // 1. PARSE / MIGRATE.
    const parsed = PF.player.parse(saved && typeof saved === "object" ? saved.player : null);
    const player = parsed.player;
    if (parsed.quarantine) this._park(chatId, parsed.quarantine.slot, parsed.quarantine.entry);

    // 1b. VERSION RE-ADOPTION. A block this build could not read last time is
    // readable now. It CONSUMES the slot — that is what makes a third boot a
    // no-op — and the block it displaces is parked in setAside, which no machine
    // ever restores: two live blocks cannot both be the player's state, and only
    // the player can say which one they meant.
    const held = PF.quarantine.peek("version");
    const heldV = held && typeof held.fromV === "number" && Number.isFinite(held.fromV) ? held.fromV : null;
    if (held && held.adoptable === true && heldV !== null && heldV <= PF.player.currentV()) {
      const readopted = PF.player.parse(held.block);
      if (readopted.source === "saved") {
        PF.quarantine.consume(chatId, "version");
        // A stamp entry from a DIFFERENT lineage is not evidence about this one.
        const stamp = PF.quarantine.peek("stamp");
        if (stamp && stamp.fromV !== held.fromV) PF.quarantine.discard(chatId, "stamp");
        // setAside is a LIST, so a SECOND re-adoption on a later boot parks its
        // displaced block beside the first instead of finding the slot full and
        // dropping a live block on the floor. Nobody but the player resolves
        // this slot, and two displacements are two things to offer them.
        this._park(chatId, "setAside", {
          reason: "displaced",
          fromV: player.v,
          block: PF.player.serialize(player),
        });
        Object.assign(player, readopted.player);
      }
    }

    // 2. STAMPS / SEVERANCE, then the other direction: a stamp slot whose world
    // is the world we just built is a save coming home.
    const applied = PF.player.applyStamps(player, world, brief, briefExpected);
    const notices = [...applied.notices];
    if (applied.severed && !this._park(chatId, applied.severed.slot, applied.severed.entry)) {
      // applyStamps has ALREADY stripped the live block by the time it hands the
      // entry over, so a refusal here is a real loss — and the notice it wrote
      // promises the opposite. The bag merges a second severance now, so this
      // only fires when the entry will not fit at all; when it does fire, the
      // player gets the true sentence instead of the comforting one.
      notices.length = 0;
      // THE SAME EVENT AS THE SENTENCE IT REPLACES, with the other outcome — so
      // it takes that sentence's own subject. applyStamps says "what you had
      // done here"; this one used to say "what belonged to the world that
      // changed", which is true, abstract, and reads like a different incident
      // when the two sit a scroll apart in the band (plan §2.5, M3's
      // writer-site kind copy).
      notices.push("What you had done in the world that changed could not be kept, and is gone.");
    }
    if (applied.evaluated && !applied.severed) {
      const stamp = PF.quarantine.peek("stamp");
      if (stamp) {
        const restored = PF.player.restoreStamped(player, stamp, world, brief);
        if (restored) {
          Object.assign(player, restored);
          PF.quarantine.consume(chatId, "stamp");
          notices.push("What was set aside when this world changed is back.");
        }
      }
    }

    // 3. GATED DANGLING REPAIR. A repair is a NON-MUTATION: it does not dirty
    // the sim and does not arm a write of its own. The next real save carries it.
    const repaired = PF.player.repairQuests(player, world, applied.evaluated);
    notices.push(...repaired.notices);

    // 4. NOTICES, appended to the band's own array — after the severance that
    // emptied the ledger, so the one thing that survives the window is the
    // explanation for it.
    //
    // AT THE DAY IT HAPPENED, which took a format change to be able to say
    // (plan §2.5). These used to be ledger LINES, and a line at or below the
    // flush gate is one the wrap-up skips — so the day was shifted up to
    // `max(sim.day, flushedDay + 1)` to keep the notice tellable, which printed
    // a day header from the FUTURE into the tell whenever the gate had run
    // ahead of the clock. The band is told-flagged instead of day-gated, so the
    // shift is deleted along with the back-door it existed for.
    for (const text of notices) PF.player.notice(player, text, sim.day);
    return player;
  },

  /** Self-heal (review finding): ~40 engine call sites still use the unqueued
   *  whole-blob updateMetadata (issue #5076 class), any of which can silently
   *  erase our key between turns. If we have saved state but the incoming
   *  chatMeta lost the key, re-save from the in-memory authority. */
  ensurePresent(core, meta) {
    // The quarantine key has its OWN branch, and it needs one: it is written by
    // a different code path on a different cadence, and the save key being
    // intact says nothing about whether the quarantine key survived the same
    // whole-blob write. It is also not gated on _lastSerialized — a bag can be
    // the only thing this chat has written.
    PF.quarantine.ensurePresent(core, meta);
    if (!this._lastSerialized || !core.sim || !core.chatId) return;
    if (meta && typeof meta === "object" && meta[SAVE_META_KEY] == null) {
      this._lastSerialized = null; // force the next flush to actually write
      this._metaSerialized = null; // the cache PATCH dedupes separately in routes mode
      this.markDirty(core);
    }
  },

  /** Reset per-chat persistence state (chat switch). The generation counter
   *  fences every async read started before the switch: a stale response
   *  cannot be detected by comparing "current" ids (both moved to the new
   *  chat together), only by what the request captured when it started. */
  reset() {
    this._gen = (this._gen ?? 0) + 1;
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = 0;
    }
    this._timerIsBackoff = false;
    this._stopReprobe();
    this._lastSerialized = null;
    this._metaSerialized = null;
    this._forceWrite = false;
    this.mode = null;
    this._serverSerialized = null;
    this._rewindCheckInFlight = false;
    this._flushFailures = 0;
    this.degraded = false;
    this._degradeToasted = false;
    this._probePinned = false;
    this._reprobedAfterFlush = false;
    this._reprobeFailures = 0;
    // Ladder state (slice 4). _lastCheck is what teardown's clean-gate derives
    // from, so it must not survive into a chat whose row it never looked at.
    this._lastCheck = null;
    this._lastCheckAt = 0;
    this._lastOkCheckAt = 0;
    this._lastCheckedAnchor = null;
    this._anchorMoved = false;
    this._row9Failures = 0;
    this._corruptToasted = false;
    this._corruptParked = false;
    // #5406's own per-chat cache: the ordinal OUR last route write was given.
    this._putOrdinal = null;
    this._schemaVersionNoted = false;
    // The loading gate belongs to the chat it was armed for; the arriving chat
    // arms its own (90-element _switchChat) once its metadata has been read.
    // _generating and _briefCache are deliberately NOT cleared — a generation
    // in flight for the chat we are leaving must still seal, and the brief it
    // seals is what stops the next visit generating that world all over again.
    // (_briefSeenInMeta rides with the cache it describes, for the same reason.)
    this.gate = null;
    // The in-memory quarantine bag is per-chat, exactly like the caches above:
    // restore() hydrates the arriving chat's key into it a few lines later.
    PF.quarantine.reset();
    // _flushChain is deliberately NOT cleared: the chat-switch flush of the
    // chat we are LEAVING rides it, and it must still land before the new
    // chat's first write. _writeSeq is process-monotonic and never resets.
  },

  /** Probe the experience-state routes once per chat and pick the mode. In
   *  routes mode the server row is the authority: if it differs from the
   *  metadata-booted sim (e.g. the user swiped or loaded a checkpoint since the
   *  last visit), the world is rebuilt from it; if the server has no row yet,
   *  the current world (which may be a migrated legacy metadata save) is
   *  written up. Any probe failure degrades to metadata mode.
   *
   *  On the flush chain, for the same reason checkRewind is: _switchChat
   *  captures the LEAVING chat's pending write and queues it, and the probe of
   *  the chat we arrive at (or arrive BACK at) must not run beside it. Off the
   *  chain, that probe can read the row the queued write is about to replace,
   *  latch it as _serverSerialized, and rebuild the sim onto a state we
   *  ourselves superseded a moment later. */
  /** THE DECISION LADDER (plan §Q2) — ONE implementation, three consumers, and
   *  a fourth that derives from it. Every site used to ask its own version of
   *  "is this row mine, and is it newer than what I hold?", and they disagreed:
   *  adopt compared against the local snapshot, checkRewind against the last
   *  known row, the flush against nothing at all, and teardown against a byte
   *  cache. The rows below are evaluated IN ORDER and the first match wins.
   *
   *  `get` is { failed, error } or { failed:false, probe }, exactly as PF.api
   *  hands it back. `ctx` is:
   *    serverSerialized  the last row we know the server held, or null
   *    localSerialized   our current snapshot's bytes, or null
   *    seqAtIssue        _writeSeq at the moment the GET was issued
   *    game              our "New game" ordinal
   *    anchorMoved       a PUT of ours echoed an anchor we had not checked
   *    lastOkCheckAt     epoch ms of the last SUCCESSFUL check (row 9 only)
   *    now               epoch ms
   *    putOrdinal        #5406: the ordinal our last route write was given, or null
   *    mirrorOrdinal     #5406: the ordinal of the last write that moved OUR
   *                      metadata key, off the engine's mirror, or null
   *
   *  The result carries the row, the parsed state, and a PER-SITE action map —
   *  `adopt`, `rewind`, `flush` — because the same row means different things at
   *  different sites: row 6 is "the row wins" at adopt and "latch it, do not
   *  rebuild" at a rewind check.
   *
   *  ── #5406, THE WRITE ORDINAL, CONSUMED ────────────────────────────────────
   *  The engine now stamps every experience row and every metadata key from ONE
   *  per-chat monotonic counter (GET and PUT both report `writeOrdinal`; the
   *  metadata side is mirrored at `metadataWriteOrdinals[<key>]`). It is BETTER
   *  EVIDENCE INSIDE THE ROWS BELOW and never a row of its own — the rows and
   *  their per-site actions are exactly what they were — and it is read in two
   *  places:
   *
   *   • ROW 5. The own-commit GATE is unchanged: "a PUT of ours completed while
   *     this GET was in flight". `_writeSeq` cannot say WHICH row that PUT landed
   *     on, so the suspicion was unfalsifiable and a perfectly current row was
   *     discarded whenever a write happened to overlap the read. With both
   *     ordinals present, a row at or past our own last PUT's ordinal already
   *     CARRIES that write — there is nothing for it to predate — so the
   *     classification falls through to the byte comparison instead.
   *
   *   • ROWS 6/7/8. The byte comparison still picks the row. The ordinal answers
   *     the one question bytes cannot (plan §Q2a): when the row differs from a
   *     baseline that is our own metadata-booted snapshot — row 6's precondition,
   *     no anchor of ours — is the row AHEAD of that cache or BEHIND it? A row
   *     strictly behind the mirror's entry for our key is provably older than the
   *     world we are standing in, and adopting it would throw away a degraded
   *     session's entire play. That is the §5 row #5406 was filed to close, and it
   *     classifies ROW 5, whose meaning it already is: this row predates a write
   *     of ours, so ignore it and let our write proceed over it.
   *
   *  THE ANCHOR OUTRANKS THE ORDINAL, and that half is load-bearing. The ordinal
   *  orders the two STORES; only the anchor orders the TIMELINE. So the mirror
   *  test fires only when the engine says the row is NOT the reader's own anchor's
   *  save (`anchorMatched !== true`, i.e. the row came back as the namespace's
   *  latest fallback and makes no claim about where the reader is). Without that
   *  guard a swipe-back taken while the tab was closed would stop rewinding the
   *  world — because a healthy flush ALWAYS leaves the mirror one ordinal ahead of
   *  the row it paired with, the row being written first.
   *
   *  A TIE IS THE SAME WRITE, not a newer one, so both tests compare strictly.
   *  Either side unorderable — a pre-#5406 engine, a row cloned from before the
   *  feature, a mirror clobbered by a whole-blob metadata write — and every branch
   *  falls back to exactly the byte ladder that shipped without it. */
  classify(get, ctx) {
    const c = ctx || {};
    // The row's out-of-band wire era (S5 slice 8), read once and carried on every
    // decision below. It is CORROBORATION and never a row of its own: the block's
    // own `player.v` travels with the bytes it describes, and this travels with
    // the row, so nothing here may branch on it. Rows 0 and 9 return before it is
    // read, which is correct — neither has a row to describe.
    let rowSchemaVersion = null;
    const decide = (row, extra) => ({
      row,
      ...LADDER[row],
      state: null,
      serialized: null,
      rawState: null,
      anchor: null,
      writeOrdinal: null,
      rowSchemaVersion,
      ...extra,
    });

    // Row 9 is CLASSIFIED SEPARATELY and never consumes the PUT ladder's
    // ceiling: a probe that did not answer is not a write that failed, and
    // spending a backoff rung on it would take the session's saves down with
    // the network's bad minute.
    if (!get || get.failed) {
      // Fresh means "we looked at THIS row recently and it was writable". An
      // echoed anchor MOVE cancels that outright: the write landed somewhere
      // nobody has looked at, so the freshness we hold is about a different row
      // and spending it here is a blind overwrite at an unexamined anchor.
      const fresh =
        c.anchorMoved !== true &&
        typeof c.lastOkCheckAt === "number" &&
        c.lastOkCheckAt > 0 &&
        (c.now ?? 0) - c.lastOkCheckAt < CHECK_FRESH_MS;
      return decide(9, { fresh, error: get?.error ?? null });
    }
    const probe = get.probe || {};
    // Not a row at all: 404/409 are the route saying it is not here, which is a
    // MODE signal the caller acts on, not a state of the row.
    if (!probe.available) return decide(0, { status: probe.status ?? 0 });
    const body = probe.body || {};
    rowSchemaVersion = schemaVersionOf(body.schemaVersion);
    const anchor = body.anchor && typeof body.anchor === "object" ? body.anchor : null;
    const exists = body.exists === true;
    const state = body.state;
    const shaped = !!state && typeof state === "object" && !Array.isArray(state);

    // ── 1. UNPARSEABLE ────────────────────────────────────────────────────────
    // Engine #5407 hands the raw stored text back on the failure path only, so
    // the PRESENCE of the key is the corruption signal — that is what keeps a
    // damaged row distinguishable from a legitimately stored null. Older engines
    // ship neither, so the legacy inference stands in: we only ever PUT a shaped
    // object, so exists-with-nothing-shaped can only be damage.
    // NEVER rebuild from this row. At the flush site the PUT proceeds, because
    // the write IS the repair.
    if (exists) {
      const rawState = typeof body.rawState === "string" ? body.rawState : null;
      if (body.stateUnparseable === true || rawState !== null || !shaped) {
        return decide(1, { anchor, rawState, rawStateTruncated: body.rawStateTruncated === true });
      }
      // ── 2. FOREIGN GAME ORDINAL ─────────────────────────────────────────────
      // TOTAL by construction: a row with no player block, or one whose ordinal
      // is not a finite number, reads as game 1 — which is what every row
      // written before S5 is. Unshaped rows never reach here; they are row 1.
      // The row is IGNORED outright: no rebuild, no toast, and _serverSerialized
      // is NOT updated, because a row from a game the player retired is not
      // evidence about the game they are in.
      const ordinal = state.player;
      const g =
        ordinal && typeof ordinal === "object" && typeof ordinal.game === "number" && Number.isFinite(ordinal.game)
          ? ordinal.game
          : 1;
      const ours = typeof c.game === "number" && Number.isFinite(c.game) ? c.game : 1;
      if (g !== ours) return decide(2, { anchor, state, foreignGame: g });
    }

    // ── 3 / 4. NO ROW AT THIS ANCHOR, split by whether we ever had one ────────
    if (!exists) {
      if (c.serverSerialized === null || c.serverSerialized === undefined) return decide(3, { anchor });
      // We held an anchor and the row is gone: the timeline rewound PAST our
      // first save. Re-read once — a GET that lands inside the PUT route's
      // delete-then-insert window finds no row at all — and only then rewind.
      return decide(4, { anchor });
    }

    const serialized = JSON.stringify(state);
    // #5406, read defensively at every hop — see ordinalOf and the docstring.
    const rowOrdinal = ordinalOf(body.writeOrdinal);
    const putOrdinal = ordinalOf(c.putOrdinal);
    const mirrorOrdinal = ordinalOf(c.mirrorOrdinal);

    // ── 5. OWN-COMMIT SUSPECT ─────────────────────────────────────────────────
    // A PUT of ours completed while this GET was in flight, so the row it read
    // predates the one we just wrote. Adopting it would rewind the world onto a
    // state we superseded ourselves; the cure at a write site is to re-PUT.
    //
    // #5406 DISPROVES it where it can: a row whose ordinal is at or past the one
    // our own last PUT was given already carries that write, so the overlap the
    // gate detected was with a write this row has. The gate itself is unchanged —
    // without an overlap the question is not asked at all, and asking it on the
    // ordinal alone would turn every swipe-back onto an older row into a row 5
    // and kill the rewind.
    if (typeof c.seqAtIssue === "number" && c.seqAtIssue !== _writeSeq) {
      const carriesOurWrite = rowOrdinal !== null && putOrdinal !== null && rowOrdinal >= putOrdinal;
      if (!carriesOurWrite) return decide(5, { anchor, state, serialized, writeOrdinal: rowOrdinal });
    }

    // ── 6 / 7 / 8. THE BYTE COMPARISON ────────────────────────────────────────
    // The baseline is the last row we know the server held; with none, it is our
    // own snapshot, which is what makes adopt's "the row wins" and a rewind
    // check's "latch it" the same comparison with different actions.
    //
    // An echoed anchor MOVE forces the ANCHORED branch on even without a
    // baseline of our own: the write landed somewhere nobody looked, so a
    // difference there is a genuine external state and takes the rewind path
    // rather than being latched in silence. It deliberately does NOT change the
    // baseline itself — comparing against the local snapshot instead would make
    // every step the player took since the write look like an external move and
    // rewind their own walking away.
    const anchored = (c.serverSerialized !== null && c.serverSerialized !== undefined) || c.anchorMoved === true;
    const baseline =
      c.serverSerialized !== null && c.serverSerialized !== undefined
        ? c.serverSerialized
        : (c.localSerialized ?? null);
    if (serialized !== baseline) {
      // #5406 — WHICH STORE IS LATER? Only where the baseline is our own
      // metadata-booted snapshot (no anchor of ours), and only where the engine
      // says this row is not the reader's own anchor's save. Both conditions
      // matter: with an anchor of our own the row store is already this session's
      // authority, and a row that IS the visible anchor's save is a timeline claim
      // that outranks any ordinal. What is left is exactly the case the ordinal
      // was filed for — a boot whose metadata cache was written by a session that
      // never reached the row store — and there the row is the stale one.
      if (
        !anchored &&
        body.anchorMatched !== true &&
        rowOrdinal !== null &&
        mirrorOrdinal !== null &&
        rowOrdinal < mirrorOrdinal
      ) {
        return decide(5, { anchor, state, serialized, writeOrdinal: rowOrdinal, staleByOrdinal: true });
      }
      return decide(anchored ? 7 : 6, { anchor, state, serialized, writeOrdinal: rowOrdinal });
    }
    return decide(8, { anchor, state, serialized, writeOrdinal: rowOrdinal });
  },

  /** Bookkeeping every site shares: what the last completed check decided, when
   *  the last ANSWERED one was, when the last one that found a WRITABLE row was,
   *  and the anchor it read. The two clocks are not the same clock and conflating
   *  them was a bug: a row-4 check answers (so it moves `_lastCheckAt`, which is
   *  what the pre-check's skip window measures) but it found the row GONE, so it
   *  must not move `_lastOkCheckAt` — the thing row 9's freshness means. With one
   *  clock, an unresolved lost-row check made the very next teardown look fresh
   *  and ship a full-snapshot overwrite on the strength of it. */
  _recordCheck(decided) {
    this._lastCheck = decided;
    this._noteSchemaVersion(decided);
    if (decided.row !== 9) {
      this._lastCheckAt = Date.now();
      if (decided.flush === "proceed") this._lastOkCheckAt = this._lastCheckAt;
      this._anchorMoved = false; // consumed by the check it forced
      this._row9Failures = 0; // the route answered; its own ladder starts over
      if (decided.anchor) this._lastCheckedAnchor = decided.anchor;
    }
    return decided;
  },

  /** THE PRECEDENCE, stated where it is enforced (S5 slice 8). A row carries its
   *  wire era twice over: **in band** as `state.player.v`, and **out of band** as
   *  the route's own `schemaVersion` column. The in-band value is the AUTHORITY
   *  and the column is corroboration, and the reason is which one travels with
   *  the bytes: `player.v` is inside the block it describes, so a row cloned to
   *  another anchor, restored from a checkpoint, hand-edited, or written by a
   *  tool that never paired the two still reads at the version it honestly
   *  declares. The column exists so a reader that has NOT parsed the state — a
   *  future build triaging rows, an external tool reading an export — can tell
   *  the era anyway.
   *
   *  So nothing here branches on the column. The one thing worth doing when the
   *  two disagree is saying so, once per chat: it means the row was written by
   *  something that did not keep them in step, which is a fact a bug report
   *  wants and a fact no other signal carries. */
  _noteSchemaVersion(decided) {
    if (this._schemaVersionNoted) return;
    const row = decided.rowSchemaVersion;
    if (row === null || row === undefined) return;
    const block = decided.state && typeof decided.state === "object" ? decided.state.player : null;
    const inBand = block && typeof block === "object" && Number.isSafeInteger(block.v) && block.v >= 1 ? block.v : null;
    if (inBand === null || inBand === row) return;
    this._schemaVersionNoted = true;
    console.warn(
      `[pixelforge] this row is stamped schemaVersion ${row} and the player block inside it declares v ${inBand}; ` +
        "the block's own version is the authority and is what the read used",
    );
  },

  /** One GET, classified. Returns null when the generation fence closed under
   *  it — a response for the chat we left decides nothing about this one. */
  async _check(core, chatId, gen, seqAtIssue, localSerialized) {
    let get;
    try {
      get = { failed: false, probe: await PF.api.getExperienceState(chatId) };
    } catch (err) {
      get = { failed: true, error: err };
    }
    if (gen !== (this._gen ?? 0) || chatId !== core.chatId) return null;
    return this._recordCheck(
      this.classify(get, {
        serverSerialized: this._serverSerialized,
        localSerialized: localSerialized ?? this._localSerialized(core),
        seqAtIssue,
        game: this._gameOrdinal(core),
        anchorMoved: this._anchorMoved,
        lastOkCheckAt: this._lastOkCheckAt,
        now: Date.now(),
        putOrdinal: this._putOrdinal,
        mirrorOrdinal: this._mirrorOrdinal(core),
      }),
    );
  },

  /** The wire era this build stamps on a row it writes (S5 slice 8): the player
   *  block's own derived version, which is the only versioned thing in the
   *  envelope that moves. Both write paths send it, so a row's column and the
   *  `player.v` inside it agree on every row this build produces — and _check's
   *  _noteSchemaVersion is what notices when a row was written by something that
   *  did not keep them in step. Never read back as authority (see the precedence
   *  note there); it is what a reader that has not parsed the state gets. */
  _rowSchemaVersion() {
    const v = PF.player?.currentV?.();
    return typeof v === "number" && Number.isSafeInteger(v) && v >= 1 ? v : 1;
  },

  /** #5406's mirror entry for OUR metadata key: the ordinal of the last write that
   *  actually MOVED `pixelforge`. Read off the host's chatMeta, which can lag a
   *  write of our own — and lagging only ever makes the number SMALLER, so the one
   *  comparison it feeds errs toward the byte ladder rather than toward silence.
   *  Every hop is checked: the key can be absent (pre-#5406 engine), a non-object
   *  (a whole-blob metadata write clobbered it), or hold something that is not a
   *  usable ordinal. */
  _mirrorOrdinal(core) {
    const meta = core && core.host && typeof core.host.chatMeta === "object" ? core.host.chatMeta : null;
    const mirror = meta && meta[ORDINAL_MIRROR_KEY];
    if (!mirror || typeof mirror !== "object" || Array.isArray(mirror)) return null;
    return ordinalOf(Object.prototype.hasOwnProperty.call(mirror, SAVE_META_KEY) ? mirror[SAVE_META_KEY] : null);
  },

  _localSerialized(core) {
    try {
      const snap = this.snapshot(core);
      return snap ? JSON.stringify(snap) : null;
    } catch {
      return null;
    }
  },

  /** The "New game" ordinal this session is playing. Older-game rows are inert
   *  at every ladder site and are RETAINED — deletion is the player's explicit
   *  choice through the engine's management verbs (plan §8 #5). */
  _gameOrdinal(core) {
    const g = core?.sim?.player?.game;
    return typeof g === "number" && Number.isFinite(g) ? g : 1;
  },

  /** Apply a classification at a REWIND-shaped site (the turn-edge check and the
   *  flush pre-check both land here). `reread` marks the second pass row 4 asks
   *  for. Returns { acted, settled }: `acted` is whether the world changed under
   *  it, `settled` is the row the call actually ENDED on — which is not the row
   *  it was handed when a row-4 re-read resolves to something else, and the
   *  pre-check has to decide on the row that is really there. */
  async _applyRewind(core, decided, chatId, gen, seqAtIssue, reread) {
    if (decided.row === 1) {
      // A row-1 classification at ANY site means the next write repairs the row
      // and destroys the only copy of its bytes. Park them wherever that is
      // about to happen, not only at boot.
      await this._noteCorruptRow(core, chatId, decided, false);
      return { acted: false, settled: decided };
    }
    if (decided.rewind === "latch") {
      this._serverSerialized = decided.serialized;
      return { acted: false, settled: decided };
    }
    if (decided.row === 4) {
      if (!reread) {
        // ONE re-read. A GET landing inside the PUT route's delete-then-insert
        // window sees no row and would otherwise rewind a perfectly live world
        // back to its baseline, toast and all.
        const again = await this._check(core, chatId, gen, seqAtIssue);
        if (!again) return { acted: false, settled: null };
        return this._applyRewind(core, again, chatId, gen, seqAtIssue, true);
      }
      this._serverSerialized = null;
      this._rebuild(core, null);
      core.hud?.toast(decided.toast);
      // _rebuild primes _lastSerialized with the bytes it just built, so this
      // markDirty would dedupe to nothing and the row the rewind just found
      // MISSING would never be re-created. The force flag exists for exactly
      // this: the next write goes up whatever the caches say.
      this._forceWrite = true;
      this.markDirty(core);
      this._lastCheck = null; // acted on; it no longer gates teardown
      return { acted: true, settled: decided };
    }
    if (decided.row === 7) {
      this._serverSerialized = decided.serialized;
      this._rebuild(core, decided.state);
      core.hud?.toast(decided.toast);
      // The rebuilt snapshot need not serialize to the row's own bytes (a pre-S5
      // row rebuilds with a default player block on it), so the world we now
      // show still owes the server a write — and _rebuild just primed the cache
      // with those very bytes, so it owes it through the force flag.
      this._forceWrite = true;
      this.markDirty(core);
      this._lastCheck = null;
      return { acted: true, settled: decided };
    }
    return { acted: false, settled: decided };
  },

  adopt(core) {
    const task = () => this._adoptNow(core);
    this._flushChain = (this._flushChain ?? Promise.resolve()).then(task, task);
    return this._flushChain;
  },

  async _adoptNow(core) {
    if (!core.chatId || this.mode !== null) return;
    // THE LOADING GATE holds the PROBE too, not just the write: row 3's adopt
    // action is "first-write", so probing a gated chat would write the world
    // nobody has entered up as if it were play. _liftGate is what calls adopt.
    if (this.gateHolds(core)) return;
    const gen = this._gen ?? 0;
    const chatId = core.chatId;
    const seqAtIssue = _writeSeq;
    const decided = await this._check(core, chatId, gen, seqAtIssue);
    // Switched mid-probe: _check fences on the CAPTURED generation and chat id —
    // a response for the old chat must never rebuild the new one, and its
    // REJECTION must never demote the new one either (adopt() short-circuits on
    // mode !== null, so the demotion would stick for the session).
    if (!decided) return;
    if (decided.row === 9) {
      const err = decided.error;
      // A transient 500 or a network blip at boot used to cost timeline rewind
      // for the WHOLE session. Pin it instead — a pin is re-probed. …but only
      // when re-asking could plausibly get a different answer: no status at all
      // is a transport failure and 5xx is the server having a bad minute, while
      // 401/403 and every other status the route MEANT is an answer, and a
      // minute-timer re-asking it is noise the player pays for.
      this.mode = "metadata";
      const status = err && typeof err.status === "number" ? err.status : 0;
      if (status === 0 || status >= 500) this._pinMetadataMode(core);
      console.warn("[pixelforge] experience-state probe failed; using metadata saves", err);
      return;
    }
    if (decided.adopt === "metadata") {
      this.mode = "metadata";
      return;
    }
    this.mode = "routes";
    if (decided.adopt === "repair") {
      // CORRUPT ROW. Boot from metadata (which is exactly what already happened
      // — restore() ran before the probe), tell the player once, and park a
      // bounded excerpt of the damaged bytes BEFORE the repairing write goes
      // out. The row's own contents are recoverable by no other client-side
      // means, and the repair destroys them.
      await this._noteCorruptRow(core, chatId, decided, true);
      this._lastSerialized = null;
      this.markDirty(core);
      return;
    }
    void this._clearCorruptExcerpt(core, chatId);
    if (decided.adopt === "rebuild") {
      // THE ROW WINS (plan §Q2a). No client-visible datum orders the two stores
      // across a timeline move, so the anchored row is authority and the
      // metadata-booted world yields to it — and §Q2a's other half is that the
      // player is TOLD, which shipped missing. The message is the LADDER's
      // (`adoptToast`) rather than the site's, because row 6 says a different
      // thing here than it says at a rewind check.
      this._serverSerialized = decided.serialized;
      this._rebuild(core, decided.state);
      if (decided.adoptToast) core.hud?.toast(decided.adoptToast);
      return;
    }
    if (decided.anchorCache && decided.serialized !== null) this._serverSerialized = decided.serialized;
    if (decided.adopt === "first-write" || decided.adopt === "ignore") {
      // No row of ours yet — or one belonging to a game the player retired,
      // which is the same thing for our purposes. Adopt the in-memory world
      // (implicitly migrating a legacy metadata save into the anchored store).
      this._lastSerialized = null; // force the write even if metadata matched
      this.markDirty(core);
    }
  },

  /** A row-1 row will be REPAIRED by the next write, and that write destroys the
   *  only copy of the damaged bytes there is. So the park is hoisted here and
   *  called from every site that sees the classification — boot adopt, the
   *  turn-edge check, and the flush pre-check — instead of only the first of the
   *  three. First-loss-wins on the excerpt, so three sightings cost one park.
   *
   *  `tell` is separate, and deliberately not every site: the turn edge does not
   *  repair anything and nothing visible changed for the player there, so it
   *  stays silent (pinned by harness case (ad)). Boot and the pre-check both
   *  have the repairing write immediately behind them, and they say it once. */
  async _noteCorruptRow(core, chatId, decided, tell) {
    if (!decided || decided.row !== 1) return;
    if (tell && !this._corruptToasted) {
      this._corruptToasted = true;
      core.hud?.toast(decided.toast);
    }
    await this._parkCorruptExcerpt(core, chatId, decided);
  },

  /** Park the raw text of a damaged row under its own metadata key, bounded.
   *  Evidence for a bug report, not a backup: nothing client-side can turn it
   *  back into a world, and the write that repairs the row destroys it. */
  async _parkCorruptExcerpt(core, chatId, decided) {
    if (this._corruptParked || typeof decided.rawState !== "string" || !decided.rawState) return;
    this._corruptParked = true;
    const excerpt = {
      at: new Date().toISOString(),
      truncated: decided.rawStateTruncated === true || decided.rawState.length > CORRUPT_EXCERPT_CHARS,
      text: decided.rawState.slice(0, CORRUPT_EXCERPT_CHARS),
    };
    try {
      await PF.api.patchMetadata(chatId, { [CORRUPT_EXCERPT_KEY]: excerpt });
    } catch (err) {
      // The repair still proceeds. Holding the world hostage to a diagnostic
      // would be the wrong trade.
      console.warn("[pixelforge] could not park the damaged row's text; repairing anyway", err);
    }
  },

  /** …and the next healthy adopt takes it away again. The metadata PATCH has no
   *  delete-by-null convention (it is a shallow merge), so the key is nulled
   *  rather than removed. */
  async _clearCorruptExcerpt(core, chatId) {
    const meta =
      core.host && typeof core.host.chatMeta === "object" && core.host.chatMeta !== null ? core.host.chatMeta : null;
    if (!meta || meta[CORRUPT_EXCERPT_KEY] == null) return;
    try {
      await PF.api.patchMetadata(chatId, { [CORRUPT_EXCERPT_KEY]: null });
      meta[CORRUPT_EXCERPT_KEY] = null;
    } catch (err) {
      console.warn("[pixelforge] could not clear the parked damaged-row text", err);
    }
  },

  /** Metadata mode entered by FAILURE rather than by a 404/409 mode signal
   *  (plan §Q2a). Re-probed once after the first metadata write that lands and
   *  on a ~60s timer until it clears, which shrinks the window in which a
   *  pinned session's play is stranded outside the timeline-anchored store. */
  _pinMetadataMode(core) {
    this._probePinned = true;
    this._reprobedAfterFlush = false;
    if (this._reprobeTimer) return;
    this._reprobeFailures = 0; // a fresh pin gets a fresh rung count, not the last one's
    const gen = this._gen ?? 0;
    this._reprobeTimer = setInterval(() => {
      if (gen !== (this._gen ?? 0)) return; // reset() clears the timer; belt and braces
      void this._reprobe(core);
    }, REPROBE_INTERVAL_MS);
  },

  _stopReprobe() {
    if (this._reprobeTimer) {
      clearInterval(this._reprobeTimer);
      this._reprobeTimer = 0;
    }
    this._reprobeInFlight = false;
  },

  /** Retry the routes probe for a pinned session. On success this is a FIRST
   *  WRITE, never the rewind path: the pinned session has been playing against
   *  metadata, so its in-memory world is the live one and the route store has
   *  nothing of ours to compare against. _lastSerialized = null forces the
   *  write; _serverSerialized stays null so checkRewind's own null guards keep
   *  it inert until that write establishes the anchor. */
  async _reprobe(core) {
    if (!this._probePinned || this.mode !== "metadata" || !core.chatId || this._reprobeInFlight) return;
    this._reprobeInFlight = true;
    const gen = this._gen ?? 0;
    const chatId = core.chatId;
    try {
      const probe = await PF.api.getExperienceState(chatId);
      if (gen !== (this._gen ?? 0) || chatId !== core.chatId) return;
      if (!probe.available) {
        // Not a failure after all — this engine or chat genuinely has no
        // Experience row. Stop asking.
        this._probePinned = false;
        this._stopReprobe();
        return;
      }
      this.mode = "routes";
      this._probePinned = false;
      this._stopReprobe();
      this._serverSerialized = null;
      this._lastSerialized = null;
      // …and the LADDER state the pinned session accumulated goes with it. The
      // pin was created by a row-9 boot probe, so _lastCheck is that row 9 with
      // _lastOkCheckAt still at 0 — carried into routes mode it makes
      // _teardownAllowed() refuse the very first pagehide after the promotion,
      // on the strength of a check that decided the mode and nothing else. A
      // freshly promoted session has never looked at its row, which is exactly
      // the "never checked at all" case the gate treats as a proceed.
      this._lastCheck = null;
      this._lastCheckAt = 0;
      this._lastOkCheckAt = 0;
      this._lastCheckedAnchor = null;
      this._anchorMoved = false;
      this._row9Failures = 0;
      // …and a flush already parked in an await would put _lastSerialized
      // straight back when it lands, cancelling the promotion's first write
      // with nothing to show for it. The force flag outlives that: only the
      // write that consumes it clears it.
      this._forceWrite = true;
      this.markDirty(core);
    } catch {
      // Still pinned, but not forever: eight failed rungs and the timer stops.
      // The pin itself stays set, so a metadata write that lands later still
      // earns its one-shot re-probe on real evidence the network came back.
      this._reprobeFailures += 1;
      if (this._reprobeFailures >= REPROBE_GIVEUP) this._stopReprobe();
    } finally {
      if (gen === (this._gen ?? 0)) this._reprobeInFlight = false;
    }
  },

  /** Routes mode, on each finished turn: if the server state moved under us
   *  (swipe, branch, checkpoint load — all rewrite the visible anchor), rebuild
   *  the world from it. Our own writes keep _serverSerialized current, so this
   *  only fires on external timeline changes. */
  checkRewind(core) {
    // On the flush chain, not beside it. The "our own writes keep
    // _serverSerialized current" invariant that makes this safe lived entirely
    // in a comment: a rewind check interleaving with a flush's awaits could
    // read the row we were halfway through replacing and rebuild the sim onto
    // it, discarding the pending local mutation. Serializing them makes the
    // arrangement structural instead of accidental.
    const task = () => this._checkRewindNow(core);
    this._flushChain = (this._flushChain ?? Promise.resolve()).then(task, task);
    return this._flushChain;
  },

  async _checkRewindNow(core) {
    if (this.mode !== "routes" || !core.chatId || this._rewindCheckInFlight) return;
    // Belt and braces behind the gate: a gated chat never reaches routes mode
    // (adopt is held), but the turn edge fires on host props and the invariant
    // "nothing touches the world while the gate holds" should not depend on that.
    if (this.gateHolds(core)) return;
    this._rewindCheckInFlight = true;
    const gen = this._gen ?? 0;
    const chatId = core.chatId;
    const seqAtIssue = _writeSeq;
    try {
      const decided = await this._check(core, chatId, gen, seqAtIssue);
      if (!decided) return; // switched mid-probe, or the chat moved under it
      // Row 9 is transient and the next turn edge retries; rows 2 and 5 both
      // resolve to "ignore" and touch nothing — a retired game's row and a row
      // our own write overtook are neither of them evidence that the timeline
      // moved. Row 1 also touches the world not at all, but it does park the
      // damaged row's bytes: the next flush's PUT is the repair, and it is the
      // last moment anything can read them.
      await this._applyRewind(core, decided, chatId, gen, seqAtIssue, false);
    } finally {
      // A stale completion must not clear the NEW chat's in-flight flag.
      if (gen === (this._gen ?? 0)) this._rewindCheckInFlight = false;
    }
  },

  _rebuild(core, saved) {
    const meta =
      core.host && typeof core.host.chatMeta === "object" && core.host.chatMeta !== null ? core.host.chatMeta : {};
    core.sim = this.simFromSaved(saved, meta, core.chatId);
    this._lastSerialized = JSON.stringify(this.snapshot(core));
    core.render?.clearZones();
    // A rebuild can change the theme; the asset loader is theme-aware and
    // no-ops when nothing changed.
    void PF.assets.load(core);
    core.hud?.refreshChips();
  },

  markDirty(core) {
    // THE LOADING GATE (plan §Q3b): a chat that has not entered play emits
    // nothing. Refused HERE and not merely at the write, so a gated chat arms no
    // timer either — a world nobody is playing should cost no wakeups.
    if (this.gateHolds(core)) return;
    if (this._timer) return; // a live timer already covers it — a backoff rung included
    this._timerIsBackoff = false;
    this._timer = setTimeout(() => {
      this._timer = 0;
      this._timerIsBackoff = false;
      void this.flush(core, false);
    }, 2500);
  },

  /** What a flush would write, decided against the caches AS THEY STAND NOW.
   *  Route persistence and metadata-cache persistence dedupe SEPARATELY: a
   *  failed cache write must keep retrying on later flushes even while the
   *  route row is already current. Returns null when there is nothing pending.
   *  Throws whatever snapshot/stringify throws — every caller is inside a
   *  guard, and swallowing it here would hide a real serialization bug. */
  _pendingWrite(core) {
    // THE LOADING GATE, at the one chokepoint every write path passes through:
    // the debounce, the retry ladder, the chat-switch capture and the last-detach
    // flush all resolve their payload here, so one refusal covers all four. The
    // pagehide path builds its own snapshot and carries its own (flushTeardown).
    if (this.gateHolds(core)) return null;
    const snap = this.snapshot(core);
    if (!snap || !core.chatId) return null;
    const serialized = JSON.stringify(snap);
    // _forceWrite outranks both caches: it exists precisely because a cache can
    // be reassigned by a flush that was already in flight when the force was set.
    const forced = this._forceWrite;
    const routeNeeded = forced || serialized !== this._lastSerialized;
    const metaNeeded = forced || this._metaSerialized !== serialized;
    if (!routeNeeded && (this.mode !== "routes" || !metaNeeded)) return null;
    return {
      chatId: core.chatId,
      sim: core.sim,
      snap,
      serialized,
      routeNeeded,
      metaNeeded,
      forced,
      mode: this.mode,
      gen: this._gen ?? 0,
    };
  },

  /** Pre-flight fallback. When the snapshot will not fit, the FIRST thing to
   *  drop is a newer build's block: our own state is what this session is
   *  playing, and a build older than slice 1 wrote rows without any carry at
   *  all — so dropping it is a return to the previous contract, not new loss.
   *  Returns null when there is no carry to drop; the caller decides whether
   *  what comes back actually fits.
   *
   *  A slim write leaves the caches holding the SLIM bytes, so the next flush
   *  re-snapshots with the carry and trips the pre-flight again. That is the
   *  point: the moment the newer build's block shrinks back under the wall we
   *  start carrying it again, and the cost meanwhile is one repeat write of
   *  bytes the server already has, on save events the player generates anyway. */
  _snapshotWithoutCarry(sim, chatId) {
    const extra = sim && sim._envelopeExtra;
    const envelopeCarry = extra && Object.keys(extra).length > 0;
    // The block carries unknown keys of its own now, and either carry alone is
    // reason enough to try the slim snapshot: a foreign field that only exists
    // INSIDE `player` used to leave this returning null and the session
    // degrading with a shed still available.
    let blockCarry;
    try {
      const full = PF.player.serialize(sim?.player);
      const slim = PF.player.serialize(sim?.player, true);
      blockCarry = JSON.stringify(full) !== JSON.stringify(slim);
    } catch {
      blockCarry = false;
    }
    if (!envelopeCarry && !blockCarry) return null;
    const snap = this.snapshot({ sim, chatId }, true);
    if (!snap) return null;
    return { snap, serialized: JSON.stringify(snap) };
  },

  /** Chat switch: the pending write belongs to the chat being LEFT, so it has
   *  to be captured SYNCHRONOUSLY. The chained flush that used to serve this
   *  seam snapshotted when the chain got round to it — by which time reset()
   *  had cleared the dedupe caches and core.chatId/core.sim had been
   *  reassigned, so it wrote the NEW chat's world under the new id and the
   *  mutation still sitting in the old chat's 2.5s debounce window was gone. */
  captureFlush(core) {
    try {
      return this._pendingWrite(core);
    } catch (err) {
      console.warn("[pixelforge] chat-switch snapshot failed", err);
      return null;
    }
  },

  /** Serialize flushes: a teardown flush and a debounced flush can otherwise
   *  overlap and double-write (the dedupe check reads _lastSerialized, which is
   *  only written after the awaits). `.then(task, task)` and not `.then(task)`:
   *  a rejected link used to skip every task queued behind it and leave the
   *  chain permanently rejected, so one bad flush killed all later saves.
   *  `capture` is a pre-taken _pendingWrite for the chat-switch seam. */
  flush(core, teardown, capture) {
    const task = () => this._flushNow(core, teardown, capture);
    this._flushChain = (this._flushChain ?? Promise.resolve()).then(task, task);
    return this._flushChain;
  },

  async _flushNow(core, teardown, capture) {
    // A backoff rung is NOT cancellable by an unrelated flush. Cancelling it
    // and letting _rearm re-arm from here would make the ladder measure the
    // time since the last TRIGGER instead of the time since the outage began —
    // and a teardown flush, which never re-arms at all, would silently delete
    // the pending retry outright.
    if (!capture && this._timer && !this._timerIsBackoff) {
      clearTimeout(this._timer);
      this._timer = 0;
    }
    let job = null;
    try {
      // Snapshot and stringify INSIDE the try: outside it, a throwing
      // serialization rejected the chain rather than costing one flush.
      job = capture ?? this._pendingWrite(core);
      if (!job) return;
      // Every post-await assignment is fenced on the generation the job was
      // built at. A chat-switch capture is stale by construction (reset()
      // bumped the counter before this ran), so its write lands but touches
      // none of the new chat's caches, dirty flag, or retry state.
      const fresh = () => job.gen === (this._gen ?? 0);
      if (job.serialized.length > MAX_SNAPSHOT_CHARS) {
        // Before giving up on the session, drop the one part of the payload
        // that is not ours. A newer build's block is unreadable here and can be
        // arbitrarily large; the world the player is standing in outranks it.
        const slim = this._snapshotWithoutCarry(job.sim, job.chatId);
        if (!slim || slim.serialized.length > MAX_SNAPSHOT_CHARS) {
          if (fresh()) {
            this._degrade(
              core,
              slim
                ? `this world's own save is ${slim.serialized.length} chars, over the limit even with a newer build's block dropped`
                : `this world's own save is ${job.serialized.length} chars`,
            );
          }
          return;
        }
        console.warn(
          `[pixelforge] a newer build's data does not fit (${job.serialized.length} chars); saving this world's own state without it`,
        );
        job = { ...job, snap: slim.snap, serialized: slim.serialized };
      }
      // Did anything reach the server? A flush where the route row landed and
      // the write-through cache did NOT is a partial write, and counting it as
      // landed resets the failure counter — which pins the ladder at its bottom
      // rung and retries a broken metadata route every 2.5s for the session.
      let landed = false;
      if (job.mode === "routes") {
        // CHECK, THEN WRITE (plan §Q2). A PUT is a full-snapshot overwrite of
        // whatever stands at the visible anchor, so writing without looking is
        // how a swipe-back gets clobbered by a debounce timer that fired half a
        // second later. Rows 4 and 7 are the two that block; everything else
        // proceeds, including the damaged row (the write is the repair) and the
        // retired game's row (ours outranks it).
        //
        // `teardown` here is the LAST-DETACH flush (90-element:91) and nothing
        // else — pagehide takes flushTeardown, which never reaches this
        // function. The page is alive on a detach, so it gets the ordinary
        // checked write its own comment already claims for it; skipping the
        // check meant the one write most likely to be racing a swipe was the
        // one write that never looked.
        if (job.routeNeeded) {
          const gate = await this._precheck(core, job);
          if (gate === "block") return;
          if (gate === "cache-only") {
            // Row 9: the route did not answer. That forbids the PUT — a
            // full-snapshot overwrite of a row we have not seen — and forbids
            // nothing else. The write-through metadata cache is ours outright
            // and is exactly what an old-engine or cold boot reads next, so
            // abandoning the whole flush over an unanswered GET was three
            // persistence paths stopped by one.
            job = { ...job, routeNeeded: false };
          }
          // …and the derived clean-gate on top, for the detach path: the
          // pre-check may have been skipped as fresh, in which case this is the
          // last completed check's verdict rather than a new one.
          //
          // SCOPED TO THE ROUTE WRITE (round-2 fix), and the order is why: the
          // gate protects the PUT, the one write nobody takes back, and row 9
          // above has already withdrawn it. Unscoped, the gate then re-blocked
          // on that same row 9 — the cache-only downgrade sets _lastCheck
          // unconditionally — and killed the metadata PATCH as well, so a detach
          // during a GET outage wrote NOTHING. There is no route write left here
          // to gate.
          if (teardown && job.routeNeeded && !this._teardownAllowed()) return;
        }
        // Route row first (the authority), metadata second as write-through
        // boot cache + old-engine fallback. A metadata failure is non-fatal
        // once the route write landed — but it stays pending and retries.
        if (job.routeNeeded) {
          const echo = await PF.api.putExperienceState(job.chatId, job.snap, teardown, this._rowSchemaVersion());
          // Bumped OUTSIDE the fence: _writeSeq is process-global, not per-chat.
          // A captured chat-switch PUT is stale for every cache on this object
          // and still completed on the wire, so a GET issued before it must not
          // be adopted as authority. A spurious bump costs one discarded rewind
          // check; a missed one costs a rewind onto a superseded row.
          _writeSeq += 1;
          landed = true;
          if (fresh()) {
            // INSIDE the fence, unlike _writeSeq: the echoed anchor and the
            // moved flag are per-chat caches, and a captured chat-switch write
            // says nothing about the anchor the chat we are now on is sitting on.
            this._noteAnchorEcho(echo);
            this._serverSerialized = job.serialized;
            this._lastSerialized = job.serialized;
            if (job.forced) this._forceWrite = false;
            if (job.sim) job.sim.dirty = false;
          }
        }
        let cacheError = null;
        if (job.metaNeeded) {
          try {
            await PF.api.patchMetadata(job.chatId, { [SAVE_META_KEY]: job.snap }, teardown);
            landed = true;
            if (fresh()) this._metaSerialized = job.serialized;
          } catch (err) {
            cacheError = err;
          }
        }
        if (cacheError) {
          // Through the classifier, not a bare markDirty: that re-armed a flat
          // 2.5s retry forever against a route that had already refused. The
          // 409 branch is suppressed — a 409 HERE is the metadata route
          // talking, and dropping route authority on it would be a non sequitur.
          this._onWriteFailed(core, cacheError, teardown, job, true);
        } else if (landed && fresh()) {
          this._onWriteLanded(core);
        }
        return;
      }
      await PF.api.patchMetadata(job.chatId, { [SAVE_META_KEY]: job.snap }, teardown);
      if (fresh()) {
        this._lastSerialized = job.serialized;
        this._metaSerialized = job.serialized;
        if (job.forced) this._forceWrite = false;
        if (job.sim) job.sim.dirty = false;
        this._onWriteLanded(core);
      }
    } catch (err) {
      this._onWriteFailed(core, err, teardown, job);
    }
  },

  /** A write landed. Clears the backoff and the degraded flag — claiming a
   *  session is still degraded after a successful write would be a lie — but
   *  NOT _degradeToasted, so the player is told once per chat, not once per
   *  flap. Also the moment a pinned session earns its first re-probe. */
  _onWriteLanded(core) {
    this._flushFailures = 0;
    this.degraded = false;
    if (this._probePinned && !this._reprobedAfterFlush) {
      this._reprobedAfterFlush = true;
      void this._reprobe(core);
    }
  },

  /** Classify a failed write. Silence was the old policy — one console.warn
   *  and the hope that some unrelated future dirty event would retry.
   *
   *  `cacheOnly` marks the routes-mode write-through PATCH: same ladder, same
   *  terminal statuses, but never the 409 fallback. A 409 from the metadata
   *  route says nothing about whether this chat still holds its Experience
   *  stamp, and dropping route authority on it would be a non sequitur. */
  _onWriteFailed(core, err, teardown, job, cacheOnly) {
    console.warn(cacheOnly ? "[pixelforge] metadata cache save failed; will retry" : "[pixelforge] save failed", err);
    // No job means snapshot/stringify itself threw: a code fault, not a write
    // failure. It costs this one flush and nothing else — backing off would
    // just re-run the same throw on a timer.
    if (!job) return;
    if (job.gen !== (this._gen ?? 0)) return; // a stale capture owns none of this state
    const status = err && typeof err.status === "number" ? err.status : 0;
    if (status === 413 || status === 422) {
      // Terminal: the payload is refused at this size and will be refused at
      // this size again. Retrying is a loop, so stop, say so, and keep
      // mutating in memory.
      this._degrade(core, `server refused the save (${status})`);
      return;
    }
    if (status === 409 && job.mode === "routes" && !cacheOnly) {
      // The chat lost its Experience stamp after adopt() committed to routes
      // mode. Every later PUT would fail exactly this way forever, so fall
      // back and let the re-probe machinery promote it again if it returns.
      this.mode = "metadata";
      this._serverSerialized = null;
      this._pinMetadataMode(core);
      console.warn("[pixelforge] experience-state route rejected the chat (409); falling back to metadata saves");
      if (!teardown) this.markDirty(core);
      return;
    }
    // Everything else — network, no status, 5xx, and any other 4xx — takes the
    // bounded ladder. An unretryable 4xx costs eight quiet attempts and then
    // stops, which is cheaper than enumerating statuses we have never seen.
    this._rearm(core, teardown);
  },

  /** The flush site's rung of the ladder. Returns "proceed", "block", or
   *  "cache-only" — the last meaning "not the route row, but the write-through
   *  metadata cache is still fine to take it".
   *
   *  The GET is SKIPPED while the last successful check is inside one debounce
   *  window: the pre-check exists so a PUT never lands on a row nobody looked
   *  at, and the turn-edge check that ran a moment ago looked at it. Without
   *  that skip every save would cost two requests instead of one, on a route
   *  that re-serializes the chat's whole shard.
   *
   *  A blocking row is NOT a write failure and must not touch the backoff
   *  ladder: the server is fine, the timeline moved. The rewind is applied and
   *  the rebuilt world re-arms an ordinary debounce of its own. */
  async _precheck(core, job) {
    const gen = job.gen;
    if (gen !== (this._gen ?? 0)) return "proceed"; // a chat-switch capture owns none of this
    const now = Date.now();
    if (
      this._lastCheck &&
      this._lastCheck.row !== 9 &&
      now - this._lastCheckAt < CHECK_FRESH_MS &&
      !this._anchorMoved
    ) {
      return this._lastCheck.flush === "block" ? "block" : "proceed";
    }
    const seqAtIssue = _writeSeq;
    const decided = await this._check(core, job.chatId, gen, seqAtIssue, job.serialized);
    if (!decided) return "proceed"; // fenced out: the capture's write still belongs on the wire
    if (decided.flush === "fresh") {
      // The probe did not answer. That is not a reason to spend a backoff rung —
      // but it is a reason not to overwrite a row we have not seen in a while.
      const fresh = decided.fresh === true;
      if (!fresh) {
        this._rearmRow9(core);
        return "cache-only";
      }
      return "proceed";
    }
    if (decided.flush === "block") {
      const applied = await this._applyRewind(core, decided, job.chatId, gen, seqAtIssue, false);
      // Decide on the row that is ACTUALLY there, not the one we were handed.
      // Row 4's re-read exists because a GET can land inside the PUT route's
      // delete-then-insert window; when it comes back row 8 the row is alive and
      // byte-identical, the world is not stale, and blocking anyway dropped a
      // whole debounce cycle with nothing re-armed to carry it. Only a row that
      // still blocks after the re-read blocks the write.
      const settled = applied.settled;
      if (applied.acted || !settled) return "block";
      if (settled.flush === "block") return "block";
      if (settled.flush === "fresh") {
        if (settled.fresh !== true) {
          this._rearmRow9(core);
          return "cache-only";
        }
        return "proceed";
      }
      await this._noteCorruptRow(core, job.chatId, settled, true);
      return "proceed";
    }
    await this._noteCorruptRow(core, job.chatId, decided, true);
    if (decided.anchorCache && decided.serialized !== null && this._serverSerialized !== null) {
      // Latch a row we agree with, so the next check has a current baseline.
      this._serverSerialized = decided.serialized;
    }
    return "proceed";
  },

  /** Row 9's OWN ladder. A GET route that will not answer is not a write that
   *  failed, so it must not spend a rung of the write backoff — but the old cure
   *  was a bare markDirty, which re-armed a flat 2.5 s poll for as long as the
   *  outage lasted and put no ceiling on it at all. Same shape as _rearm, same
   *  give-up point, same landing place: after the last rung the session falls
   *  back to trigger-driven saves rather than polling a dead route forever. Any
   *  answered check resets it (_recordCheck). */
  _rearmRow9(core) {
    this._row9Failures = (this._row9Failures ?? 0) + 1;
    if (this._row9Failures > FLUSH_BACKOFF_GIVEUP) return;
    if (this._timer) return; // a live timer already covers it, and sooner
    const delay = FLUSH_BACKOFF_MS[Math.min(this._row9Failures - 1, FLUSH_BACKOFF_MS.length - 1)];
    this._timerIsBackoff = true;
    this._timer = setTimeout(() => {
      this._timer = 0;
      this._timerIsBackoff = false;
      void this.flush(core, false);
    }, delay);
  },

  /** THE PUT-ANCHOR ECHO (plan §Q2). The row lands at whatever the visible
   *  anchor is when the write is SERVED, and a turn can finish between the check
   *  and the write. When the echoed anchor is not the one we checked, two things
   *  follow and both are load-bearing: the next flush may NOT skip its pre-check
   *  as fresh (that freshness was about a different anchor), and a difference
   *  found there takes the rewind path instead of being latched in silence. */
  _noteAnchorEcho(echo) {
    // #5406 rides the same echo, and it is recorded BEFORE the anchor guard: the
    // ordinal is the only thing that can tell a row carrying our own last write
    // from one that predates it, and a route that answered without an anchor
    // still told us which ordinal our row was given.
    const ordinal = ordinalOf(echo && typeof echo === "object" ? echo.writeOrdinal : null);
    if (ordinal !== null) this._putOrdinal = ordinal;
    const anchor =
      echo && typeof echo === "object" && echo.anchor && typeof echo.anchor === "object" ? echo.anchor : null;
    if (!anchor) return;
    const last = this._lastCheckedAnchor;
    if (last && (anchor.messageId !== last.messageId || anchor.swipeIndex !== last.swipeIndex))
      this._anchorMoved = true;
    this._lastCheckedAnchor = anchor;
  },

  /** Teardown's clean-gate, DERIVED from the ladder rather than guessed at.
   *  Only rows 4 and 7 block — the two that say the timeline moved and our
   *  snapshot is the stale one. Row 9 blocks only once its freshness lapses: a
   *  probe that failed thirty seconds ago says nothing useful about the row, and
   *  a keepalive PUT is the one write nobody gets to take back. Never having
   *  checked at all is a PROCEED: that is a fresh chat, and its first write is
   *  the row's creation. */
  _teardownAllowed() {
    // The clean-set is DERIVED FROM THE ROUTE LADDER, and metadata mode has no
    // row in it. A boot probe that failed both picked the mode and left a row-9
    // _lastCheck behind, and that row-9 with no successful check to measure
    // against then refused every teardown write for the rest of the session —
    // in a mode where the only store is a metadata key the PATCH owns outright
    // and no anchor can move under.
    if (this.mode !== "routes") return true;
    const last = this._lastCheck;
    if (!last) return true;
    if (last.flush === "block") return false;
    // Row 9. Measured against the last check that found the row WRITABLE, not
    // the last one that merely answered: an unresolved row 4 answers, moves the
    // answered-clock, and means the opposite of fresh. And an echoed anchor move
    // cancels freshness outright, because whatever we last saw, we did not see
    // it at the anchor this write would land on.
    if (last.flush === "fresh") return !this._anchorMoved && Date.now() - this._lastOkCheckAt < CHECK_FRESH_MS;
    return true;
  },

  _rearm(core, teardown) {
    if (teardown || this.degraded) return;
    this._flushFailures += 1;
    if (this._flushFailures > FLUSH_BACKOFF_GIVEUP) return; // fall back to trigger-driven saves
    if (this._timer) return; // a live timer already covers it, and sooner
    const delay = FLUSH_BACKOFF_MS[Math.min(this._flushFailures - 1, FLUSH_BACKOFF_MS.length - 1)];
    // Shares markDirty's timer on purpose: while a server is failing, a busy
    // player must not be able to reset the backoff to 2.5s on every zone change.
    // _timerIsBackoff is what makes that hold in the other direction too — see
    // _flushNow, which declines to cancel a rung it did not arm.
    this._timerIsBackoff = true;
    this._timer = setTimeout(() => {
      this._timer = 0;
      this._timerIsBackoff = false;
      void this.flush(core, false);
    }, delay);
  },

  /** Stop retrying, tell the player once, keep playing. Mutations continue in
   *  memory; they are simply not reaching the server. */
  _degrade(core, reason) {
    this.degraded = true;
    console.warn(`[pixelforge] save degraded: ${reason}; progress stays in this session`);
    if (this._degradeToasted) return;
    this._degradeToasted = true;
    core.hud?.toast("This world is too large to save — progress stays in this session only.");
  },

  /** The page is going away (pagehide). This must NOT queue behind _flushChain:
   *  an ordinary flush sitting mid-await would swallow the last write of the
   *  session entirely. So it snapshots synchronously off the live sim and fires
   *  BOTH keepalive requests without awaiting between them — awaiting the PUT
   *  first lets the unload land before the PATCH is even dispatched.
   *
   *  Sized against the KEEPALIVE wall, which is this path's own and nobody
   *  else's: the Fetch standard caps TOTAL in-flight keepalive body bytes at
   *  64 KiB (65,536) per origin, and routes mode sends two bodies against that
   *  one quota. MAX_SNAPSHOT_CHARS does not imply it and is not meant to — the
   *  server cap bounds an ORDINARY flush, this bounds the pair a dying page
   *  fires. So the gate here is 2 × TextEncoder-encoded bytes ≤
   *  KEEPALIVE_PAIR_BUDGET_BYTES, and when the pair does not fit the PUT goes
   *  alone — losing the write-through cache is a repairable inconvenience,
   *  losing both is the session.
   *
   *  Remount-detach keeps the ordinary chained path (90-element) — the page is
   *  alive there and a re-arm is still worth something. */
  flushTeardown(core) {
    if (!core || !core.chatId || !core.sim) return;
    // THE LOADING GATE. This path does not go through _pendingWrite, so it needs
    // its own refusal — and it is the path that would matter most: closing the tab
    // while the world is still generating must not stamp the placeholder world
    // into the row store on the way out.
    if (this.gateHolds(core)) return;
    let snap;
    let serialized = "";
    try {
      snap = this.snapshot(core);
      if (!snap) return;
      serialized = JSON.stringify(snap);
    } catch (err) {
      console.warn("[pixelforge] teardown snapshot failed", err);
      return;
    }
    // THE CLEAN-GATE, derived from the decision ladder (plan §3.4): the write
    // goes out iff the bytes actually changed AND the last completed check
    // resolved to a proceed row. Teardown cannot afford a GET of its own — the
    // page is going away and an await would spend the unload window — so it
    // spends the last check's verdict instead. Only rows 4 and 7 block.
    if (serialized === this._lastSerialized) return;
    if (!this._teardownAllowed()) {
      console.warn("[pixelforge] teardown declined: the last check said the timeline moved under this world");
      return;
    }
    if (serialized.length > MAX_SNAPSHOT_CHARS) {
      // Same order as the ordinary flush: a newer build's block is the first
      // thing to drop, and this world's own state is the last.
      const slim = this._snapshotWithoutCarry(core.sim, core.chatId);
      if (!slim || slim.serialized.length > MAX_SNAPSHOT_CHARS) {
        this._degrade(
          core,
          slim
            ? `this world's own save is ${slim.serialized.length} chars, over the limit even with a newer build's block dropped`
            : `this world's own save is ${serialized.length} chars`,
        );
        return;
      }
      console.warn(
        `[pixelforge] a newer build's data does not fit (${serialized.length} chars); saving this world's own state without it`,
      );
      snap = slim.snap;
      serialized = slim.serialized;
    }
    const chatId = core.chatId;
    const routes = this.mode === "routes";
    // The keepalive quota is shared by the pair; see the docstring.
    const pairFits = 2 * new TextEncoder().encode(serialized).length <= KEEPALIVE_PAIR_BUDGET_BYTES;
    if (routes && !pairFits) {
      console.warn(
        "[pixelforge] teardown pair exceeds the keepalive quota; sending the route save alone (the metadata cache repairs on the next load)",
      );
    }
    // A pagehide is not always a death: bfcache restores the page and play
    // carries on against this very singleton. Leaving the caches holding the
    // PRE-teardown bytes then makes the next checkRewind read the row we just
    // wrote, find it different from _serverSerialized, and "rewind" the world
    // onto our own write — discarding whatever happened after the restore, with
    // a toast to announce it. So each request updates the cache it owns WHEN IT
    // LANDS, fenced on the generation the teardown was taken at. If the page
    // really does die, none of these handlers ever run, which is the point.
    const gen = this._gen ?? 0;
    const fresh = () => gen === (this._gen ?? 0);
    // `unfenced` runs on ANY success, `onLanded` only while the generation the
    // teardown was taken at is still current. The split is the same one
    // _flushNow makes and states as an invariant at :1231-1236: per-chat caches
    // are fenced, _writeSeq is not, because it is process-global and a write
    // that completed on the wire superseded every row a GET could still be
    // holding — whichever chat we happen to be on when it lands.
    const settle = (promise, what, onLanded, unfenced) => {
      if (!promise || typeof promise.then !== "function") return;
      promise.then(
        (value) => {
          if (unfenced) unfenced(value);
          if (fresh()) onLanded(value);
        },
        (err) => console.warn(`[pixelforge] teardown ${what} failed`, err),
      );
    };
    // Both started before either is awaited.
    const put = routes ? PF.api.putExperienceState(chatId, snap, true, this._rowSchemaVersion()) : null;
    const patch = routes && !pairFits ? null : PF.api.patchMetadata(chatId, { [SAVE_META_KEY]: snap }, true);
    settle(
      put,
      "route save",
      (echo) => {
        // A pagehide is not always a death: if the page comes back, the anchor
        // the teardown write actually landed on is what the next check has to
        // reason against.
        this._noteAnchorEcho(echo);
        this._serverSerialized = serialized;
        this._lastSerialized = serialized;
      },
      () => {
        _writeSeq += 1; // any GET issued before this point read a superseded row
      },
    );
    settle(patch, "metadata save", () => {
      this._metaSerialized = serialized;
      // In metadata mode the PATCH is the authority, not a cache, so it owns
      // the route-side dedupe too — exactly as _flushNow assigns them together.
      if (!routes) this._lastSerialized = serialized;
    });
  },
};

// Registry completeness, in 20-world's startup-assertion idiom: ENVELOPE_KEYS
// and the snapshot literal have to agree in BOTH directions, and neither
// direction fails loudly on its own.
//   • a key emitted but NOT listed → simFromSaved treats it as foreign on the
//     way in and parks a stale copy of our own field on _envelopeExtra;
//   • a key listed but NOT emitted → the read skips it and the write omits it,
//     so a newer build's field is silently deleted. That is the slice-1 bug.
// Cheap enough to run at load: one snapshot off a synthetic sim.
{
  const probe = PF.save.snapshot({
    chatId: "",
    sim: {
      world: { seed: 0, theme: "", bindings: {} },
      zoneId: "",
      x: 0,
      y: 0,
      facing: 0,
      clockMin: 0,
      day: 1,
      intro: null,
      _envelopeExtra: null,
    },
  });
  for (const key of Object.keys(probe)) {
    if (!ENVELOPE_KEYS.has(key))
      throw new Error(`pixelforge: snapshot emits "${key}", which ENVELOPE_KEYS does not list`);
  }
  for (const key of ENVELOPE_KEYS) {
    if (!(key in probe)) throw new Error(`pixelforge: ENVELOPE_KEYS lists "${key}", which snapshot does not emit`);
  }
}
