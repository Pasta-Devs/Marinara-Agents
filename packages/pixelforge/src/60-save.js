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
PF.save = {
  _timer: 0,
  _lastSerialized: null,
  _flushChain: null,
  /** null until adopt() probes; then "routes" | "metadata". */
  mode: null,
  /** Serialized last-known server-side route state (ours or adopted). */
  _serverSerialized: null,
  _rewindCheckInFlight: false,

  snapshot(core) {
    const sim = core.sim;
    if (!sim) return null;
    return {
      v: 1,
      chatId: core.chatId,
      seed: sim.world.seed,
      zone: sim.zoneId,
      x: Math.round(sim.x),
      y: Math.round(sim.y),
      facing: sim.facing,
      clockMin: sim.clockMin,
      day: sim.day,
      bindings: sim.world.bindings,
    };
  },

  /** Where /game/create actually stores the wizard config (review finding):
   *  the chooser wraps our cfg as setupConfig.experienceConfig = cfg, and the
   *  server persists the whole setupConfig under meta.gameSetupConfig — so our
   *  own `experienceConfig.seed` lands two levels deep. Read every plausible
   *  depth so a future un-nesting doesn't strand old games. */
  _configSeed(meta) {
    const setup = meta && typeof meta.gameSetupConfig === "object" && meta.gameSetupConfig !== null ? meta.gameSetupConfig : null;
    const outer = setup && typeof setup.experienceConfig === "object" && setup.experienceConfig !== null ? setup.experienceConfig : null;
    const inner = outer && typeof outer.experienceConfig === "object" && outer.experienceConfig !== null ? outer.experienceConfig : null;
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

  /** Build a sim from a save object (route state or the metadata key). */
  simFromSaved(saved, meta, chatId) {
    // Explicit null checks: 0 is a legitimate seed, so truthiness chaining would
    // silently rebuild a zero-seeded world from the wrong source.
    let seed = saved && typeof saved.seed === "number" ? saved.seed >>> 0 : null;
    if (seed === null) seed = this._configSeed(meta);
    if (seed === null) seed = PF.hashStr(String(chatId));
    const world = PF.world.build(seed);
    const sim = new PF.Sim(world);
    if (saved && saved.v === 1) {
      if (typeof saved.zone === "string" && world.zones[saved.zone]) sim.zoneId = saved.zone;
      const z = sim.zone();
      if (typeof saved.x === "number") sim.x = PF.clamp(saved.x, PF.TILE, (z.w - 1) * PF.TILE);
      if (typeof saved.y === "number") sim.y = PF.clamp(saved.y, PF.TILE, (z.h - 1) * PF.TILE);
      if (typeof saved.facing === "number") sim.facing = saved.facing & 3;
      if (typeof saved.clockMin === "number") sim.clockMin = PF.clamp(saved.clockMin | 0, 0, 24 * 60 - 1);
      if (typeof saved.day === "number") sim.day = Math.max(1, saved.day | 0);
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
    this._lastSerialized = null;
    this._metaSerialized = null;
    this.mode = null;
    this._serverSerialized = null;
    this._rewindCheckInFlight = false;
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
      this.mode = "metadata";
      console.warn("[pixelforge] experience-state probe failed; using metadata saves", err);
    }
  },

  /** Routes mode, on each finished turn: if the server state moved under us
   *  (swipe, branch, checkpoint load — all rewrite the visible anchor), rebuild
   *  the world from it. Our own writes keep _serverSerialized current, so this
   *  only fires on external timeline changes. */
  async checkRewind(core) {
    if (this.mode !== "routes" || !core.chatId || this._rewindCheckInFlight) return;
    this._rewindCheckInFlight = true;
    const gen = this._gen ?? 0;
    const chatId = core.chatId;
    try {
      const probe = await PF.api.getExperienceState(chatId);
      if (gen !== (this._gen ?? 0) || chatId !== core.chatId) return; // switched mid-probe
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
    const meta = core.host && typeof core.host.chatMeta === "object" && core.host.chatMeta !== null ? core.host.chatMeta : {};
    core.sim = this.simFromSaved(saved, meta, core.chatId);
    this._lastSerialized = JSON.stringify(this.snapshot(core));
    core.render?.clearZones();
    core.hud?.refreshChips();
  },

  markDirty(core) {
    if (this._timer) return;
    this._timer = setTimeout(() => {
      this._timer = 0;
      void this.flush(core, false);
    }, 2500);
  },

  /** Serialize flushes: a teardown flush and a debounced flush can otherwise
   *  overlap and double-write (the dedupe check reads _lastSerialized, which is
   *  only written after the awaits). */
  flush(core, teardown) {
    this._flushChain = (this._flushChain ?? Promise.resolve()).then(() => this._flushNow(core, teardown));
    return this._flushChain;
  },

  async _flushNow(core, teardown) {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = 0;
    }
    const snap = this.snapshot(core);
    if (!snap || !core.chatId) return;
    const serialized = JSON.stringify(snap);
    // Route persistence and metadata-cache persistence dedupe SEPARATELY: a
    // failed cache write must keep retrying on later flushes even while the
    // route row is already current.
    const metaCurrent = this.mode !== "routes" || this._metaSerialized === serialized;
    if (serialized === this._lastSerialized && metaCurrent) return;
    try {
      if (this.mode === "routes") {
        // Route row first (the authority), metadata second as write-through
        // boot cache + old-engine fallback. A metadata failure is non-fatal
        // once the route write landed — but it stays pending and retries.
        if (serialized !== this._lastSerialized) {
          await PF.api.putExperienceState(core.chatId, snap, teardown);
          this._serverSerialized = serialized;
          this._lastSerialized = serialized;
          if (core.sim) core.sim.dirty = false;
        }
        if (this._metaSerialized !== serialized) {
          try {
            await PF.api.patchMetadata(core.chatId, { pixelforge: snap }, teardown);
            this._metaSerialized = serialized;
          } catch (err) {
            if (!teardown) this.markDirty(core); // schedule a cache repair pass
            console.warn("[pixelforge] metadata cache save failed (route save landed); will retry", err);
          }
        }
        return;
      }
      await PF.api.patchMetadata(core.chatId, { pixelforge: snap }, teardown);
      this._lastSerialized = serialized;
      this._metaSerialized = serialized;
      if (core.sim) core.sim.dirty = false;
    } catch (err) {
      // A failed save retries on the next dirty mark; never interrupts play.
      console.warn("[pixelforge] save failed", err);
    }
  },
};
