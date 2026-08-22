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
  },
  7: {
    name: "differs-anchored",
    adopt: "rebuild",
    rewind: "rewind",
    flush: "block",
    anchorCache: true,
    toast: "The world rewound with the story.",
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
// Local pre-flight. The route's own ceiling is 262,144 chars (422) behind a
// ~1.59 MB body limit (413), but neither is the real wall: teardown fires TWO
// keepalive requests and the Fetch standard caps in-flight keepalive bodies at
// 64 KiB per origin, and every PUT re-serializes the chat's whole shard across
// up to 100 anchors. Refusing locally keeps the 422 retry loop unreachable.
// The snapshot's own design budget is 24 KB (plan §4); this is the backstop.
const MAX_SNAPSHOT_CHARS = 32_768;
// Teardown sends a PAIR of keepalive requests in routes mode, and the Fetch
// standard caps TOTAL in-flight keepalive body bytes at 64 KiB (65,536) per
// origin — the whole pair against one quota, not one budget each. So the wall
// is 2 × the UTF-8 byte length of the snapshot, plus the two JSON wrappers
// (`{"state":…}` and `{"pixelforge":…}`, ~26 bytes together) and whatever else
// the page has in flight at unload. 57,000 leaves ~8.5 KB of that headroom.
// MAX_SNAPSHOT_CHARS alone does NOT imply the pair fits: 32,768 ASCII chars
// doubles to 65,536, over the quota on its own.
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
    snap.player = PF.player.serialize(sim.player);
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
    const saved = meta && typeof meta.pixelforge === "object" && meta.pixelforge !== null ? meta.pixelforge : null;
    PF.quarantine.hydrate(meta, chatId);
    return this.simFromSaved(saved, meta, chatId);
  },

  /** The sealed world brief. Primary home: the TOP-LEVEL pixelforgeBrief
   *  metadata key (atomic under the queued shallow-merge PATCH — no
   *  read-modify-write of the whole setup config). The nested config location
   *  remains readable for chats sealed before the key moved. Absent on
   *  pre-0.4.0 games → legacy layout. */
  _configBrief(meta) {
    const top =
      meta && typeof meta.pixelforgeBrief === "object" && meta.pixelforgeBrief !== null ? meta.pixelforgeBrief : null;
    if (top && Array.isArray(top.cast)) return top;
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
      if (candidate && typeof candidate === "object" && Array.isArray(candidate.cast)) return candidate;
    }
    return null;
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

  /** Surface-side world generation (spec §5, amended): fully NON-BLOCKING.
   *  The chat boots on the themed legacy world immediately; the one #5135
   *  call runs behind a toast, the sealed brief stores atomically under
   *  pixelforgeBrief (3 retries), and the world rebuilds on arrival. Runs at
   *  most once per chat: the stored key (sealed brief or a skipped marker) is
   *  the one-shot guard, so old chats and completed chats never re-generate. */
  async maybeGenerateBrief(core) {
    if (!core.chatId || this._generating) return;
    const chatId = core.chatId;
    const meta =
      core.host && typeof core.host.chatMeta === "object" && core.host.chatMeta !== null ? core.host.chatMeta : {};
    if (meta.pixelforgeBrief !== undefined) return;
    if (this._configBrief(meta)) return;
    if (!this._configGenerate(meta)) return;
    this._generating = true;
    try {
      core.hud?.toast("Generating your world — keep exploring meanwhile…");
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
      const sealed = await PF.brief.generate(chatId, { theme, seed, preferences });
      if (!sealed) {
        // Transient failure (busy engine, network, timeout, route absent): do
        // NOT seal — the key stays absent and the next visit tries again. The
        // default world stays fully playable meanwhile.
        core.hud?.toast("World generation couldn't run — it will retry next visit.");
        return;
      }
      let stored = false;
      for (let attempt = 0; attempt < 3 && !stored; attempt++) {
        try {
          await PF.api.patchMetadata(chatId, { pixelforgeBrief: sealed });
          stored = true;
        } catch (err) {
          if (attempt === 2) console.warn("[pixelforge] brief storage failed; keeping the default world", err);
          else await new Promise((resolve) => setTimeout(resolve, 500 * (attempt + 1)));
        }
      }
      if (!stored || chatId !== core.chatId) return;
      // Rebuild onto the generated world (the default one has only seconds of
      // play on it). Fresh sim, fresh bindings; spatial re-seeds next turn.
      // The envelope carry is NOT play state — it is a newer build's fields —
      // so it transplants across the wholesale sim replacement rather than
      // dying with the throwaway world (_rebuild gets it via simFromSaved).
      const carriedExtra = core.sim?._envelopeExtra;
      // The player block crosses the same seam, and it crosses SPLIT (plan §Q5,
      // the one-release compat shim for chats created before the loading gate).
      // World-free fields — the purse, the skills, the board's completion counts
      // — mean the same thing in the compiled world. Everything world-bound
      // belonged to the throwaway one and goes to the stamp slot instead of
      // being silently reinterpreted against people who do not exist here.
      const carriedPlayer = core.sim?.player;
      core.sim = new PF.Sim(PF.world.build(seed, theme, sealed));
      if (carriedExtra) core.sim._envelopeExtra = carriedExtra;
      const moved = PF.player.transplant(carriedPlayer, core.sim.world, sealed);
      core.sim.player = moved.player;
      if (moved.severed) PF.quarantine.put(chatId, moved.severed.slot, moved.severed.entry);
      this._lastSerialized = null;
      core.render?.clearZones?.();
      void PF.assets.load(core);
      core.hud?.refreshChips();
      core.hud?.toast("The world takes shape.");
      this.markDirty(core);
    } finally {
      this._generating = false;
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
    const brief = this._configBrief(meta);
    const world = PF.world.build(seed, theme, brief);
    // The pre-brief boot world of a generation-enabled chat is a throwaway
    // that the sealed brief will replace — stamped so the World Maps export
    // (§8) never registers its zones on the user's map. A sealed brief or a
    // {skipped:true} marker makes the world final.
    if (!brief && meta?.pixelforgeBrief === undefined && this._configGenerate(meta)) world.interim = true;
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
        sim.intro = {
          world: saved.intro.world === true,
          zones: saved.intro.zones && typeof saved.intro.zones === "object" ? { ...saved.intro.zones } : {},
          npcs: saved.intro.npcs && typeof saved.intro.npcs === "object" ? { ...saved.intro.npcs } : {},
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

  /** The §Q5 rehydration, factored out so the ordering is one readable list
   *  rather than a tail on a 90-line function. Never throws: every branch has a
   *  defaults boot behind it. */
  _rehydratePlayer(saved, world, brief, meta, chatId, sim) {
    const briefExpected = !brief && meta?.pixelforgeBrief === undefined && this._configGenerate(meta);
    // 1. PARSE / MIGRATE.
    const parsed = PF.player.parse(saved && typeof saved === "object" ? saved.player : null);
    const player = parsed.player;
    if (parsed.quarantine) PF.quarantine.put(chatId, parsed.quarantine.slot, parsed.quarantine.entry);

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
        PF.quarantine.put(chatId, "setAside", {
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
    if (applied.severed) PF.quarantine.put(chatId, applied.severed.slot, applied.severed.entry);
    const notices = [...applied.notices];
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

    // 4. NOTICES, appended to the LIVE ledger — after the severance that emptied
    // it, so the one thing that survives the window is the explanation for it.
    // Never at or below the gate: a line the gate covers is one the flush will
    // skip, and a notice nobody is ever told is worse than no notice at all.
    const noticeDay = Math.max(sim.day, player.flushedDay + 1);
    for (const text of notices) player.ledger.lines.push([noticeDay, text]);
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
    if (meta && typeof meta === "object" && meta.pixelforge == null) {
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
    this._lastCheckedAnchor = null;
    this._anchorMoved = false;
    this._corruptToasted = false;
    this._corruptParked = false;
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
   *
   *  The result carries the row, the parsed state, and a PER-SITE action map —
   *  `adopt`, `rewind`, `flush` — because the same row means different things at
   *  different sites: row 6 is "the row wins" at adopt and "latch it, do not
   *  rebuild" at a rewind check.
   *
   *  #5406 SEAM: when the engine's authoritative write ordinal lands, the
   *  own-commit test at row 5 and the byte comparison at rows 6-8 collapse into
   *  one comparison of ordinals, and _writeSeq stops being a proxy. Not consumed
   *  yet — the contract is still moving in review. */
  classify(get, ctx) {
    const c = ctx || {};
    const decide = (row, extra) => ({
      row,
      ...LADDER[row],
      state: null,
      serialized: null,
      rawState: null,
      anchor: null,
      ...extra,
    });

    // Row 9 is CLASSIFIED SEPARATELY and never consumes the PUT ladder's
    // ceiling: a probe that did not answer is not a write that failed, and
    // spending a backoff rung on it would take the session's saves down with
    // the network's bad minute.
    if (!get || get.failed) {
      const fresh =
        typeof c.lastOkCheckAt === "number" && c.lastOkCheckAt > 0 && (c.now ?? 0) - c.lastOkCheckAt < CHECK_FRESH_MS;
      return decide(9, { fresh, error: get?.error ?? null });
    }
    const probe = get.probe || {};
    // Not a row at all: 404/409 are the route saying it is not here, which is a
    // MODE signal the caller acts on, not a state of the row.
    if (!probe.available) return decide(0, { status: probe.status ?? 0 });
    const body = probe.body || {};
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

    // ── 5. OWN-COMMIT SUSPECT ─────────────────────────────────────────────────
    // A PUT of ours completed while this GET was in flight, so the row it read
    // predates the one we just wrote. Adopting it would rewind the world onto a
    // state we superseded ourselves; the cure at a write site is to re-PUT.
    if (typeof c.seqAtIssue === "number" && c.seqAtIssue !== _writeSeq) {
      return decide(5, { anchor, state, serialized });
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
    if (serialized !== baseline) return decide(anchored ? 7 : 6, { anchor, state, serialized });
    return decide(8, { anchor, state, serialized });
  },

  /** Bookkeeping every site shares: what the last completed check decided, when
   *  the last SUCCESSFUL one was, and the anchor it read. Teardown's clean-gate
   *  reads all three. */
  _recordCheck(decided) {
    this._lastCheck = decided;
    if (decided.row !== 9) {
      this._lastCheckAt = Date.now();
      this._anchorMoved = false; // consumed by the check it forced
      if (decided.anchor) this._lastCheckedAnchor = decided.anchor;
    }
    return decided;
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
        lastOkCheckAt: this._lastCheckAt,
        now: Date.now(),
      }),
    );
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
   *  for. Returns true when it acted on the world. */
  async _applyRewind(core, decided, chatId, gen, seqAtIssue, reread) {
    if (decided.rewind === "latch") {
      this._serverSerialized = decided.serialized;
      return false;
    }
    if (decided.row === 4) {
      if (!reread) {
        // ONE re-read. A GET landing inside the PUT route's delete-then-insert
        // window sees no row and would otherwise rewind a perfectly live world
        // back to its baseline, toast and all.
        const again = await this._check(core, chatId, gen, seqAtIssue);
        if (!again) return false;
        return this._applyRewind(core, again, chatId, gen, seqAtIssue, true);
      }
      this._serverSerialized = null;
      this._rebuild(core, null);
      core.hud?.toast(decided.toast);
      this.markDirty(core);
      this._lastCheck = null; // acted on; it no longer gates teardown
      return true;
    }
    if (decided.row === 7) {
      this._serverSerialized = decided.serialized;
      this._rebuild(core, decided.state);
      core.hud?.toast(decided.toast);
      // The rebuilt snapshot need not serialize to the row's own bytes (a pre-S5
      // row rebuilds with a default player block on it), so the world we now
      // show still owes the server a write.
      this.markDirty(core);
      this._lastCheck = null;
      return true;
    }
    return false;
  },

  adopt(core) {
    const task = () => this._adoptNow(core);
    this._flushChain = (this._flushChain ?? Promise.resolve()).then(task, task);
    return this._flushChain;
  },

  async _adoptNow(core) {
    if (!core.chatId || this.mode !== null) return;
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
      if (!this._corruptToasted) {
        this._corruptToasted = true;
        core.hud?.toast(decided.toast);
      }
      await this._parkCorruptExcerpt(core, chatId, decided);
      this._lastSerialized = null;
      this.markDirty(core);
      return;
    }
    void this._clearCorruptExcerpt(core, chatId);
    if (decided.adopt === "rebuild") {
      // THE ROW WINS (plan §Q2a). No client-visible datum orders the two stores
      // across a timeline move, so the anchored row is authority and the
      // metadata-booted world yields to it.
      this._serverSerialized = decided.serialized;
      this._rebuild(core, decided.state);
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
    this._rewindCheckInFlight = true;
    const gen = this._gen ?? 0;
    const chatId = core.chatId;
    const seqAtIssue = _writeSeq;
    try {
      const decided = await this._check(core, chatId, gen, seqAtIssue);
      if (!decided) return; // switched mid-probe, or the chat moved under it
      // Row 9 is transient and the next turn edge retries; rows 1, 2 and 5 all
      // resolve to "ignore" and touch nothing — a damaged row, a retired game's
      // row and a row our own write overtook are none of them evidence that the
      // timeline moved.
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
    if (!extra || Object.keys(extra).length === 0) return null;
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
        if (job.routeNeeded && !teardown) {
          const gate = await this._precheck(core, job);
          if (gate === "block") return;
        }
        // Route row first (the authority), metadata second as write-through
        // boot cache + old-engine fallback. A metadata failure is non-fatal
        // once the route write landed — but it stays pending and retries.
        if (job.routeNeeded) {
          const echo = await PF.api.putExperienceState(job.chatId, job.snap, teardown);
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
            await PF.api.patchMetadata(job.chatId, { pixelforge: job.snap }, teardown);
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
      await PF.api.patchMetadata(job.chatId, { pixelforge: job.snap }, teardown);
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

  /** The flush site's rung of the ladder. Returns "proceed" or "block".
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
        this.markDirty(core);
        return "block";
      }
      return "proceed";
    }
    if (decided.flush === "block") {
      await this._applyRewind(core, decided, job.chatId, gen, seqAtIssue, false);
      return "block";
    }
    if (decided.anchorCache && decided.serialized !== null && this._serverSerialized !== null) {
      // Latch a row we agree with, so the next check has a current baseline.
      this._serverSerialized = decided.serialized;
    }
    return "proceed";
  },

  /** THE PUT-ANCHOR ECHO (plan §Q2). The row lands at whatever the visible
   *  anchor is when the write is SERVED, and a turn can finish between the check
   *  and the write. When the echoed anchor is not the one we checked, two things
   *  follow and both are load-bearing: the next flush may NOT skip its pre-check
   *  as fresh (that freshness was about a different anchor), and a difference
   *  found there takes the rewind path instead of being latched in silence. */
  _noteAnchorEcho(echo) {
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
    const last = this._lastCheck;
    if (!last) return true;
    if (last.flush === "block") return false;
    if (last.flush === "fresh") return Date.now() - this._lastCheckAt < CHECK_FRESH_MS;
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
   *  Sized against the keepalive wall, not the route's, and the arithmetic is
   *  explicit because MAX_SNAPSHOT_CHARS does not imply it: the Fetch standard
   *  caps TOTAL in-flight keepalive body bytes at 64 KiB (65,536) per origin,
   *  routes mode sends two bodies against that one quota, and 32,768 ASCII
   *  chars doubled is already 65,536. So the gate here is
   *  2 × TextEncoder-encoded bytes ≤ KEEPALIVE_PAIR_BUDGET_BYTES, and when the
   *  pair does not fit the PUT goes alone — losing the write-through cache is a
   *  repairable inconvenience, losing both is the session.
   *
   *  Remount-detach keeps the ordinary chained path (90-element) — the page is
   *  alive there and a re-arm is still worth something. */
  flushTeardown(core) {
    if (!core || !core.chatId || !core.sim) return;
    let snap = null;
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
        "[pixelforge] teardown pair exceeds the keepalive budget; sending the route save alone (the metadata cache repairs on the next load)",
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
    const settle = (promise, what, onLanded) => {
      if (!promise || typeof promise.then !== "function") return;
      promise.then(
        (value) => {
          if (fresh()) onLanded(value);
        },
        (err) => console.warn(`[pixelforge] teardown ${what} failed`, err),
      );
    };
    // Both started before either is awaited.
    const put = routes ? PF.api.putExperienceState(chatId, snap, true) : null;
    const patch = routes && !pairFits ? null : PF.api.patchMetadata(chatId, { pixelforge: snap }, true);
    settle(put, "route save", (echo) => {
      _writeSeq += 1; // any GET issued before this point read a superseded row
      // A pagehide is not always a death: if the page comes back, the anchor the
      // teardown write actually landed on is what the next check has to reason
      // against.
      this._noteAnchorEcho(echo);
      this._serverSerialized = serialized;
      this._lastSerialized = serialized;
    });
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
