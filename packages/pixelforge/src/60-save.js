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
]);

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
// Re-probe cadence while a probe FAILURE pinned the session to metadata mode
// (plan §Q2a): a transient 500 at boot otherwise costs timeline rewind for the
// entire session, because adopt() short-circuits on mode !== null forever.
const REPROBE_INTERVAL_MS = 60_000;

PF.save = {
  _timer: 0,
  _lastSerialized: null,
  _flushChain: null,
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

  /** Reads core.sim and core.chatId and NOTHING else: 80-setup calls this with
   *  a synthetic two-key core, and reaching for core.host/hud/render there
   *  throws inside the wizard's launch handler. */
  snapshot(core) {
    const sim = core.sim;
    if (!sim) return null;
    // Unknown keys FIRST, known keys assigned over them: a newer build's field
    // rides through untouched but can never shadow one of ours. Emitted in
    // SORTED order — the flush dedupe, the adopt comparison, and the rewind
    // comparison are all string equality over JSON.stringify, so a key order
    // that drifted with the source would forge both spurious saves and
    // spurious "The world rewound with the story." toasts.
    const snap = {};
    const extra = sim._envelopeExtra;
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

  /** Restore a saved state into a freshly built world. Returns the sim. */
  restore(meta, chatId) {
    const saved = meta && typeof meta.pixelforge === "object" && meta.pixelforge !== null ? meta.pixelforge : null;
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
      core.sim = new PF.Sim(PF.world.build(seed, theme, sealed));
      if (carriedExtra) core.sim._envelopeExtra = carriedExtra;
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
      const zoneResolved = typeof saved.zone === "string" && !!world.zones[saved.zone];
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
          if (typeof zone === "string" && world.zones[zone]) {
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
    return sim;
  },

  /** Self-heal (review finding): ~40 engine call sites still use the unqueued
   *  whole-blob updateMetadata (issue #5076 class), any of which can silently
   *  erase our key between turns. If we have saved state but the incoming
   *  chatMeta lost the key, re-save from the in-memory authority. */
  ensurePresent(core, meta) {
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
    this._stopReprobe();
    this._lastSerialized = null;
    this._metaSerialized = null;
    this.mode = null;
    this._serverSerialized = null;
    this._rewindCheckInFlight = false;
    this._flushFailures = 0;
    this.degraded = false;
    this._degradeToasted = false;
    this._probePinned = false;
    this._reprobedAfterFlush = false;
    // _flushChain is deliberately NOT cleared: the chat-switch flush of the
    // chat we are LEAVING rides it, and it must still land before the new
    // chat's first write. _writeSeq is process-monotonic and never resets.
  },

  /** Probe the experience-state routes once per chat and pick the mode. In
   *  routes mode the server row is the authority: if it differs from the
   *  metadata-booted sim (e.g. the user swiped or loaded a checkpoint since the
   *  last visit), the world is rebuilt from it; if the server has no row yet,
   *  the current world (which may be a migrated legacy metadata save) is
   *  written up. Any probe failure degrades to metadata mode. */
  async adopt(core) {
    if (!core.chatId || this.mode !== null) return;
    const gen = this._gen ?? 0;
    const chatId = core.chatId;
    try {
      const probe = await PF.api.getExperienceState(chatId);
      // Switched mid-probe: fence on the CAPTURED generation and chat id — a
      // response for the old chat must never rebuild the new one.
      if (gen !== (this._gen ?? 0) || chatId !== core.chatId) return;
      if (!probe.available) {
        this.mode = "metadata";
        return;
      }
      this.mode = "routes";
      const body = probe.body || {};
      if (body.exists && body.state && typeof body.state === "object") {
        this._serverSerialized = JSON.stringify(body.state);
        const current = this.snapshot(core);
        if (current && JSON.stringify(current) !== this._serverSerialized) {
          this._rebuild(core, body.state);
        }
      } else {
        // No server row yet: adopt the in-memory world (implicitly migrating a
        // legacy metadata save into the timeline-anchored store).
        this._lastSerialized = null; // force the write even if metadata matched
        this.markDirty(core);
      }
    } catch (err) {
      // A transient 500 or a network blip at boot used to cost timeline rewind
      // for the WHOLE session: adopt() short-circuits on mode !== null and
      // nothing ever probed again. Pin it instead — a pin is re-probed.
      this.mode = "metadata";
      this._pinMetadataMode(core);
      console.warn("[pixelforge] experience-state probe failed; using metadata saves (will re-probe)", err);
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
      this.markDirty(core);
    } catch {
      // Still pinned; the interval tries again.
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
      const probe = await PF.api.getExperienceState(chatId);
      if (gen !== (this._gen ?? 0) || chatId !== core.chatId) return; // switched mid-probe
      // A PUT of ours completed while this GET was in flight: the row it read
      // predates the row we just wrote, so treating it as an external change
      // would rewind the world onto a state we ourselves superseded.
      if (seqAtIssue !== _writeSeq) return;
      if (!probe.available) return;
      const body = probe.body || {};
      if (!body.exists || !body.state || typeof body.state !== "object") {
        // The timeline rewound PAST the first persisted state: this anchor has
        // no row. Keeping the later local sim would leave the world ahead of
        // the story — fall back to the baseline build (config seed/theme) and
        // let the next save write this anchor's row.
        if (this._serverSerialized !== null) {
          this._serverSerialized = null;
          this._rebuild(core, null);
          core.hud?.toast("The world rewound with the story.");
        }
        return;
      }
      const serverSerialized = JSON.stringify(body.state);
      if (this._serverSerialized !== null && serverSerialized !== this._serverSerialized) {
        this._serverSerialized = serverSerialized;
        this._rebuild(core, body.state);
        core.hud?.toast("The world rewound with the story.");
      } else {
        this._serverSerialized = serverSerialized;
      }
    } catch {
      // Transient; the next turn edge retries.
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
    if (this._timer) return;
    this._timer = setTimeout(() => {
      this._timer = 0;
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
    const routeNeeded = serialized !== this._lastSerialized;
    const metaNeeded = this._metaSerialized !== serialized;
    if (!routeNeeded && (this.mode !== "routes" || !metaNeeded)) return null;
    return {
      chatId: core.chatId,
      sim: core.sim,
      snap,
      serialized,
      routeNeeded,
      metaNeeded,
      mode: this.mode,
      gen: this._gen ?? 0,
    };
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
    if (!capture && this._timer) {
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
        if (fresh()) this._degrade(core, `snapshot is ${job.serialized.length} chars`);
        return;
      }
      if (job.mode === "routes") {
        // Route row first (the authority), metadata second as write-through
        // boot cache + old-engine fallback. A metadata failure is non-fatal
        // once the route write landed — but it stays pending and retries.
        if (job.routeNeeded) {
          await PF.api.putExperienceState(job.chatId, job.snap, teardown);
          if (fresh()) {
            _writeSeq += 1; // any GET issued before this point is now stale
            this._serverSerialized = job.serialized;
            this._lastSerialized = job.serialized;
            if (job.sim) job.sim.dirty = false;
          }
        }
        if (job.metaNeeded) {
          try {
            await PF.api.patchMetadata(job.chatId, { pixelforge: job.snap }, teardown);
            if (fresh()) this._metaSerialized = job.serialized;
          } catch (err) {
            if (!teardown && fresh()) this.markDirty(core); // schedule a cache repair pass
            console.warn("[pixelforge] metadata cache save failed (route save landed); will retry", err);
          }
        }
        if (fresh()) this._onWriteLanded(core);
        return;
      }
      await PF.api.patchMetadata(job.chatId, { pixelforge: job.snap }, teardown);
      if (fresh()) {
        this._lastSerialized = job.serialized;
        this._metaSerialized = job.serialized;
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
   *  and the hope that some unrelated future dirty event would retry. */
  _onWriteFailed(core, err, teardown, job) {
    console.warn("[pixelforge] save failed", err);
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
    if (status === 409 && job.mode === "routes") {
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

  _rearm(core, teardown) {
    if (teardown || this.degraded) return;
    this._flushFailures += 1;
    if (this._flushFailures > FLUSH_BACKOFF_GIVEUP) return; // fall back to trigger-driven saves
    if (this._timer) return; // a live debounce already covers it, and sooner
    const delay = FLUSH_BACKOFF_MS[Math.min(this._flushFailures - 1, FLUSH_BACKOFF_MS.length - 1)];
    // Shares markDirty's timer on purpose: while a server is failing, a busy
    // player must not be able to reset the backoff to 2.5s on every zone change.
    this._timer = setTimeout(() => {
      this._timer = 0;
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
   *  Sized against the keepalive wall, not the route's: the Fetch standard caps
   *  total in-flight keepalive bodies at 64 KiB per origin and routes mode
   *  sends two, so the pair only fits while the snapshot stays well inside the
   *  24 KB design budget (plan §4).
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
    // TODO(plan §3.4): the clean-gate here should be DERIVED from the decision
    // ladder — only rows 4 and 7 block the write — once the slice-4 ladder
    // lands. Until then it is the byte comparison alone, which is what every
    // other call site uses today.
    if (serialized === this._lastSerialized) return;
    if (serialized.length > MAX_SNAPSHOT_CHARS) {
      this._degrade(core, `snapshot is ${serialized.length} chars`);
      return;
    }
    const chatId = core.chatId;
    const settle = (promise, what) => {
      if (promise && typeof promise.catch === "function") {
        promise.catch((err) => console.warn(`[pixelforge] teardown ${what} failed`, err));
      }
    };
    // Both started before either is awaited. Deliberately no cache updates:
    // the page is leaving, and a bfcache restore is better off re-writing than
    // trusting a write it never saw finish.
    const put = this.mode === "routes" ? PF.api.putExperienceState(chatId, snap, true) : null;
    const patch = PF.api.patchMetadata(chatId, { pixelforge: snap }, true);
    settle(put, "route save");
    settle(patch, "metadata save");
  },
};
