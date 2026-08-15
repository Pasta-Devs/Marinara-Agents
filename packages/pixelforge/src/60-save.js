// ── Persistence ───────────────────────────────────────────────────────────────
// One small `pixelforge` key in chat metadata via the queued PATCH route:
// debounced, event-driven, flushed with keepalive on teardown — never
// per-frame (Android whole-blob-rewrite shape, exploration R11/R28).
// Known Phase-1 limitation (documented): checkpoint-load / branch / swipe do
// not rewind this state; the durable home is game_engine_state via engine
// issue #5077 / roadmap PR-E.
PF.save = {
  _timer: 0,
  _lastSerialized: null,

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
    const seed =
      (saved && typeof saved.seed === "number" && (saved.seed >>> 0)) ||
      this._configSeed(meta) ||
      PF.hashStr(String(chatId));
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
      this.markDirty(core);
    }
  },

  markDirty(core) {
    if (this._timer) return;
    this._timer = setTimeout(() => {
      this._timer = 0;
      void this.flush(core, false);
    }, 2500);
  },

  async flush(core, teardown) {
    if (this._timer) {
      clearTimeout(this._timer);
      this._timer = 0;
    }
    const snap = this.snapshot(core);
    if (!snap || !core.chatId) return;
    const serialized = JSON.stringify(snap);
    if (serialized === this._lastSerialized) return;
    try {
      await PF.api.patchMetadata(core.chatId, { pixelforge: snap }, teardown);
      this._lastSerialized = serialized;
      if (core.sim) core.sim.dirty = false;
    } catch (err) {
      // A failed save retries on the next dirty mark; never interrupts play.
      console.warn("[pixelforge] save failed", err);
    }
  },
};
