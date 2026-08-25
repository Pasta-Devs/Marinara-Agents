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
  pending: null, // {commandId, destinationId, name, staleCount, stepwise?}
  _lastLocationId: null,
  _gen: 0,
  _seq: 0, // per-call refresh sequence: only the latest-started response applies

  reset() {
    this._gen++;
    this._seq = 0;
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

  async refresh(core, { countStale = true } = {}) {
    if (!core.chatId) return;
    const gen = this._gen;
    const chatId = core.chatId;
    // Latest-started wins: 1.12 event refreshes overlap the per-turn ones, and
    // a slow pre-commit response landing AFTER a post-commit refresh would
    // otherwise roll the world back to the departed zone (review finding).
    const seq = ++this._seq;
    try {
      const data = await PF.api.getSpatial(chatId);
      // Chat switched (or reset) or superseded while in flight — drop it.
      if (gen !== this._gen || core.chatId !== chatId || seq !== this._seq) return;
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
        if (loc === this.pending.destinationId) {
          this.pending = null; // journey landed
        } else if (loc !== this._lastLocationId) {
          if (this.pending.stepwise) {
            // An intermediate hop of a step_by_step route: progress, not
            // supersession — the completing event clears it (review finding:
            // the old rule dropped a kept stepwise pending one GET later).
            this.pending.staleCount = 0;
          } else {
            this.pending = null; // superseded server-side
          }
        } else if (countStale && ++this.pending.staleCount >= 2) {
          // Two turns with no movement → the transition was rejected somewhere
          // we can't observe. Let go so drift-following resumes. Event-driven
          // refreshes pass countStale:false so 1.12 engines don't halve this
          // fallback budget (review finding).
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
        // Same class as a walked zone entry, so the same top surface: a narrated
        // arrival is the one notice most likely to print while the player is
        // mid-paragraph (70-hud `toast`).
        core.hud?.toast(`Now at: ${this.locationName() ?? loc}`, "location");
      }
      this._lastLocationId = loc;
      core.hud?.refreshChips();
      // Spec §8: once the exterior is bound, generated zones register as map
      // locations. Fire-and-forget — every guard (done-key, in-flight, backoff,
      // chat-switch generation) lives inside the export module.
      void PF.mapsExport?.maybeSync(core);
    } catch (err) {
      // Network/parse trouble is not fatal to the world — stay on package state.
      console.warn("[pixelforge] spatial refresh failed", err);
    }
  },

  /** Capability API 1.12 events, addressed to this package by the host. The
   *  element's window listener has already matched packageId and chatId. */
  onHostEvent(core, detail) {
    // Event-driven refreshes never count toward the stale-count fallback —
    // delivery is live, and double-counting would halve the two-turn budget.
    if (detail.type === "spatial_context_refresh") {
      void this.refresh(core, { countStale: false });
      return;
    }
    const data = detail.data && typeof detail.data === "object" ? detail.data : {};
    if (detail.type === "spatial_transition_committed") {
      if (this.pending && data.commandId === this.pending.commandId) {
        // A step_by_step journey keeps its pending entry until the completing
        // event (the host's own keep-pending rule for stepwise routes); mark
        // it so refresh() treats intermediate hops as progress.
        const travel = data.travel;
        if (travel && travel.mode === "step_by_step" && travel.complete === false) this.pending.stepwise = true;
        else this.pending = null;
      }
      // With pending cleared, refresh() runs its normal drift-following: the
      // world teleports to the destination's bound zone (when one exists) and
      // announces the arrival — the feedback the polling path never gave.
      void this.refresh(core, { countStale: false });
      return;
    }
    if (detail.type === "spatial_transition_rejected") {
      if (this.pending && data.commandId === this.pending.commandId) {
        this.pending = null;
        core.hud?.toast("Travel didn't happen — the story stayed put.");
      }
      void this.refresh(core, { countStale: false });
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
    // A THIRD CAPTURE, and it is a DIFFERENT counter from the two above. Those
    // are spatial's own generation and the chat id, which fence this journey's
    // post-await branches; the player mutators fence on PF.save._gen, which moves
    // on a chat switch and is what stops this turn's wrap-up burn landing on the
    // arriving chat's block. Read pre-await, like everything else here.
    const saveGen = PF.save._gen ?? 0;
    try {
      const text = `${core.sim.composePrefix(null)} We travel to ${dest.name}.`;
      // The composed turn's own pending, closure-local — never re-read after the
      // await, where commitIntro's wholesale null waits (see 90-element interact
      // for the two ways this goes wrong).
      const pend = core.sim._pendingIntro;
      const ok = await core.host.sendMessage(text, undefined, transition);
      if (gen !== this._gen || core.chatId !== chatId) return;
      if (ok !== false) {
        core.sim?.commitIntro?.();
        // The burn, on the accepted turn. Guarded inside the mutator and its
        // refusal deliberately swallowed (plan §2.6). The captured pending hands
        // back BOTH halves of what was told — the day and the notice ROWS — so
        // the burn marks the band this turn carried and not whatever a rebuild
        // has written into the live one since (plan §2.5).
        if (pend?.ledger) PF.player.flush(core, pend.ledger.throughDay, pend.ledger.notices, saveGen);
      }
      // Both post-await branches act only on THIS journey's pending entry: a
      // 1.12 reject event may already have cleared it mid-await (a second,
      // contradictory toast would follow), and the player may already have
      // started journey B, which an unconditional clear would wipe (review).
      if (ok === false && this.pending?.commandId === transition.commandId) {
        // The host refused the turn (e.g. session concluded) — nothing is in flight.
        this.pending = null;
        core.hud?.toast("The story isn't accepting turns right now.");
      }
    } catch (err) {
      console.warn("[pixelforge] travel failed", err);
      if (gen !== this._gen || core.chatId !== chatId) return;
      if (this.pending?.commandId === transition.commandId) {
        this.pending = null;
        core.hud?.toast("Travel could not start — the map may have changed. Try again.");
        await this.refresh(core);
      }
    }
  },
};
