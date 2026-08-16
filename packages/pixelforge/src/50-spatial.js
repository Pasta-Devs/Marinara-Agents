// ── World Maps (spatial context) client ───────────────────────────────────────
// Authority rule (exploration §02): spatial context owns where the party is;
// the tile world is a view of it. Reads go through the same REST endpoint the
// host uses; writes ride sendMessage's third argument with optimistic
// concurrency. A location change with no in-flight command is narrated drift:
// teleport to the bound zone (or toast), never queue a compensating transition.
//
// Review-hardened: a generation counter guards cross-chat races (a refresh
// started for chat A must never write into chat B's world). Transition
// outcomes arrive two ways: engines with capability API 1.12 address the
// commit/reject events to this package (onHostEvent — immediate), and on
// older engines `pending` still self-clears after two refreshes with no
// movement (the stale-count fallback; events simply never arrive there).
PF.spatial = {
  data: null, // last SpatialContextResponse (or null: unbound / not fetched)
  available: false,
  pending: null, // {commandId, destinationId, name, staleCount}
  _lastLocationId: null,
  _gen: 0,

  reset() {
    this._gen++;
    this.data = null;
    this.available = false;
    this.pending = null;
    this._lastLocationId = null;
  },

  locationName() {
    const b = this.data?.breadcrumb;
    return b && b.length ? b[b.length - 1].name : null;
  },

  destinations() {
    const d = this.data?.destinations;
    if (!Array.isArray(d)) return [];
    return d
      .map((entry) => ({
        id: typeof entry.id === "string" ? entry.id : typeof entry.locationId === "string" ? entry.locationId : null,
        name: typeof entry.name === "string" ? entry.name : "(unnamed)",
      }))
      .filter((entry) => entry.id);
  },

  async refresh(core) {
    if (!core.chatId) return;
    const gen = this._gen;
    const chatId = core.chatId;
    try {
      const data = await PF.api.getSpatial(chatId);
      // Chat switched (or reset) while we were in flight — drop the response.
      if (gen !== this._gen || core.chatId !== chatId) return;
      // Both degraded modes (verified trap #6): endpoint absent (package not
      // installed) OR a game that fell back to standard mode (definition null /
      // disabled). Either way the world runs on package state alone.
      this.available = !!(data && data.definition && data.currentLocationId);
      this.data = this.available ? data : null;
      if (!this.available) return;

      const loc = data.currentLocationId;
      // Seed the starting binding: first location we ever see maps to the
      // exterior — the world's OWN start zone, never a hardcoded id (compiled
      // worlds key zones z1..; the legacy literal poisoned their bindings
      // forever and broke drift-following — review blocker).
      const world = core.sim?.world;
      const rootZone = world ? world.zones[world.startZone] : null;
      if (world && rootZone && Object.keys(world.bindings).length === 0) {
        world.bindings[loc] = world.startZone;
        rootZone.spatialLocationId = loc;
        core.markDirty();
      }
      if (this.pending) {
        if (loc === this.pending.destinationId || loc !== this._lastLocationId) {
          this.pending = null; // transition landed (or was superseded server-side)
        } else if (++this.pending.staleCount >= 2) {
          // Two turns with no movement → the transition was rejected somewhere
          // we can't observe. Let go so drift-following resumes.
          this.pending = null;
          core.hud?.toast("Travel didn't happen — the story stayed put.");
        }
      } else if (this._lastLocationId && loc !== this._lastLocationId) {
        // Narrated drift — the GM moved the party. Follow it; never compensate.
        // Guarded on the zone existing: a stale binding must degrade, not throw.
        const zoneId = world?.bindings[loc];
        const target = zoneId ? world?.zones[zoneId] : null;
        if (target && core.sim && core.sim.zoneId !== zoneId) {
          core.sim.teleport(zoneId, target.spawn.x, target.spawn.y);
        }
        core.hud?.toast(`Now at: ${this.locationName() ?? loc}`);
      }
      this._lastLocationId = loc;
      core.hud?.refreshChips();
    } catch (err) {
      // Network/parse trouble is not fatal to the world — stay on package state.
      console.warn("[pixelforge] spatial refresh failed", err);
    }
  },

  /** Capability API 1.12 events, addressed to this package by the host. The
   *  element's window listener has already matched packageId and chatId. */
  onHostEvent(core, detail) {
    if (detail.type === "spatial_context_refresh") {
      void this.refresh(core);
      return;
    }
    const data = detail.data && typeof detail.data === "object" ? detail.data : {};
    if (detail.type === "spatial_transition_committed") {
      if (this.pending && data.commandId === this.pending.commandId) {
        // A step_by_step journey keeps its pending entry until the completing
        // event (the host's own keep-pending rule for stepwise routes).
        const travel = data.travel;
        if (!(travel && travel.mode === "step_by_step" && travel.complete === false)) this.pending = null;
      }
      // With pending cleared, refresh() runs its normal drift-following: the
      // world teleports to the destination's bound zone (when one exists) and
      // announces the arrival — the feedback the polling path never gave.
      void this.refresh(core);
      return;
    }
    if (detail.type === "spatial_transition_rejected") {
      if (this.pending && data.commandId === this.pending.commandId) {
        this.pending = null;
        core.hud?.toast("Travel didn't happen — the story stayed put.");
      }
      void this.refresh(core);
    }
  },

  /** Travel via the host generation pipeline. Refusals and 409s surface as toasts. */
  async travel(core, dest) {
    if (!this.available || !core.host?.sendMessage || core.sim?.mode !== "walk") return;
    // One journey at a time: a second command would overwrite the first pending
    // entry and orphan its stale-count recovery.
    if (this.pending) {
      core.hud?.toast("A journey is already underway.");
      return;
    }
    const transition = {
      destinationId: dest.id,
      expectedDefinitionRevision: this.data.definition.revision,
      expectedCurrentLocationId: this.data.currentLocationId,
      commandId: PF.uid(),
    };
    this.pending = { commandId: transition.commandId, destinationId: dest.id, name: dest.name, staleCount: 0 };
    core.hud?.toast(`Traveling to ${dest.name}…`);
    // A chat switch during the await runs reset(); the post-await branches must
    // then leave the NEW chat's state alone (same guard refresh() uses).
    const gen = this._gen;
    const chatId = core.chatId;
    try {
      const text = `${core.sim.composePrefix(null)} We travel to ${dest.name}.`;
      const ok = await core.host.sendMessage(text, undefined, transition);
      if (gen !== this._gen || core.chatId !== chatId) return;
      if (ok !== false) core.sim?.commitIntro?.();
      if (ok === false) {
        // The host refused the turn (e.g. session concluded) — nothing is in flight.
        this.pending = null;
        core.hud?.toast("The story isn't accepting turns right now.");
      }
    } catch (err) {
      console.warn("[pixelforge] travel failed", err);
      if (gen !== this._gen || core.chatId !== chatId) return;
      this.pending = null;
      core.hud?.toast("Travel could not start — the map may have changed. Try again.");
      await this.refresh(core);
    }
  },
};
