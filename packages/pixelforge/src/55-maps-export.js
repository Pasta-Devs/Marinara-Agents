// ── World Maps export (spec §8): register generated zones as locations ────────
// The compiled world's zones become children of the location the exterior is
// bound to, through the additive locations route (World Maps 1.4.0). The map
// definition itself is the idempotency ledger: location ids are seed-stable
// (pf.<hash(seed)>.<zoneId>), diffed against definition.locations before
// posting, and a root child already carrying a zone's name is ADOPTED rather
// than twinned. All completion state is keyed by WORLD OBJECT IDENTITY, not
// chat+seed: the generation flow boots a throwaway default world and swaps in
// the compiled one under the same chat and seed (60-save), rewinds rebuild the
// sim mid-session, and a string key survived all of those — suppressing the
// real world's export while the throwaway's zones polluted the map (review
// findings). A rebuilt world is a new object, so it re-syncs, and the
// definition diff makes that re-sync a cheap re-bind.
// Everything degrades quietly: no hierarchical map, an older maps package
// without the route, a shared-world-linked chat (posting would silently stage
// unpublished draft edits to a communal world), an interim pre-brief world,
// or a terminally refused batch all mean "the world runs on package state
// alone", never a nag and never a hot retry loop.
PF.mapsExport = {
  _done: new WeakSet(), // worlds fully synced or terminally skipped this session
  _inFlightWorld: null, // the world object a _sync is currently running for
  _failed: null, // {world, at} — 60s transient backoff, world-scoped

  _hash(text) {
    let h = 0x811c9dc5;
    for (let i = 0; i < text.length; i++) {
      h ^= text.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(36);
  },

  /** Seed-stable location id for a zone. Matches the route's id charset. */
  idFor(world, zoneId) {
    return `pf.${this._hash(String(world.seed))}.${zoneId}`;
  },

  /** Fire-and-forget from spatial refresh; every guard is internal. */
  async maybeSync(core) {
    const world = core.sim?.world;
    if (!world || !PF.spatial.available || !PF.spatial.data) return;
    // The pre-brief boot world of a generation-enabled chat is a throwaway —
    // registering its zones would pollute the map forever (additive route).
    if (world.interim) return;
    // A shared-world-linked chat cannot take additive writes directly: the
    // service stages them as unpublished draft edits to the communal world,
    // which the user never asked for. Skip without marking done so unlinking
    // re-enables the export.
    if (PF.spatial.data.sharedWorld?.mode === "linked") return;
    // Without a visible location list there is nothing to diff against —
    // acting blind would prune live bindings or post duplicates.
    if (!Array.isArray(PF.spatial.data.definition?.locations)) return;
    if (this._inFlightWorld === world || this._done.has(world)) return;
    if (this._failed?.world === world && Date.now() - this._failed.at < 60000) return;
    // The exterior must already be bound (refresh seeds that on first sight);
    // its location is the parent every exported zone hangs under — and it must
    // still exist, unarchived, in the CURRENT definition: a map replacement or
    // start-over leaves persisted bindings pointing at nothing, and posting
    // under a dead parent 400s forever.
    const rootLoc = Object.keys(world.bindings).find((loc) => world.bindings[loc] === world.startZone);
    if (!rootLoc) return;
    if (!this._locationIsActive(rootLoc)) {
      this._pruneDeadBindings(core, world);
      return; // an emptied table re-seeds on the next refresh, then re-exports
    }
    this._inFlightWorld = world;
    try {
      await this._sync(core, world, rootLoc);
    } catch (err) {
      this._failed = { world, at: Date.now() };
      console.warn("[pixelforge] World Maps export failed", err);
    } finally {
      if (this._inFlightWorld === world) this._inFlightWorld = null;
    }
  },

  _locationIsActive(locId) {
    const locations = PF.spatial.data?.definition?.locations;
    const row = Array.isArray(locations) ? locations.find((location) => location.id === locId) : undefined;
    return !!row && row.status !== "archived";
  },

  /** Drop bindings whose locations no longer exist (map replaced/started
   *  over). An emptied table lets 50-spatial's first-sight seeding re-bind
   *  the exterior to wherever the party now is. */
  _pruneDeadBindings(core, world) {
    let changed = false;
    for (const locId of Object.keys(world.bindings)) {
      if (this._locationIsActive(locId)) continue;
      const zone = world.zones[world.bindings[locId]];
      if (zone && zone.spatialLocationId === locId) zone.spatialLocationId = null;
      delete world.bindings[locId];
      changed = true;
    }
    if (changed) core.markDirty();
  },

  _existingIds() {
    const locations = PF.spatial.data?.definition?.locations;
    return new Set(Array.isArray(locations) ? locations.map((location) => location.id) : []);
  },

  /** Map of trimmed lowercase name → location id for the root's children,
   *  first occurrence wins. Lets a zone ADOPT a same-named location the user
   *  (or the wizard's map instructions) already authored instead of creating
   *  a twin — the additive route could never merge them afterwards. */
  _adoptableByName(rootLoc) {
    const locations = PF.spatial.data?.definition?.locations;
    const byName = new Map();
    for (const location of Array.isArray(locations) ? locations : []) {
      if (location.parentId !== rootLoc || typeof location.name !== "string") continue;
      const nameKey = location.name.trim().toLowerCase();
      if (nameKey && !byName.has(nameKey)) byName.set(nameKey, location.id);
    }
    return byName;
  },

  /** locId per zone: its own seed-stable id when present, an adopted
   *  same-named root child, else the seed-stable id (to be created). */
  _plan(world, zoneIds, rootLoc) {
    const existing = this._existingIds();
    const adoptable = this._adoptableByName(rootLoc);
    const claimed = new Set();
    return zoneIds.map((zoneId) => {
      const pfId = this.idFor(world, zoneId);
      if (existing.has(pfId)) return { zoneId, locId: pfId, create: false };
      const nameKey = String(world.zones[zoneId].name || "")
        .trim()
        .toLowerCase();
      const adopted = nameKey ? adoptable.get(nameKey) : undefined;
      // Adopt when the location is unclaimed OR already bound to THIS zone —
      // a restored save carries prior adoptions, and refusing our own binding
      // would flip the plan back to creation (live-found regression). Never
      // steal a location bound to a different zone.
      const boundTo = adopted !== undefined ? world.bindings[adopted] : undefined;
      if (adopted && (boundTo === undefined || boundTo === zoneId) && !claimed.has(adopted)) {
        claimed.add(adopted);
        return { zoneId, locId: adopted, create: false };
      }
      return { zoneId, locId: pfId, create: true };
    });
  },

  _rowFor(world, zoneId, rootLoc) {
    const zone = world.zones[zoneId];
    const row = {
      id: this.idFor(world, zoneId),
      parentId: rootLoc,
      name: String(zone.name || zoneId).slice(0, 200),
      kind: zone.mapKind === "building" ? "building" : "place",
    };
    if (typeof zone.flavor === "string" && zone.flavor.trim()) row.description = zone.flavor.slice(0, 4000);
    return row;
  },

  /** Abort when the run's ground truth moved: chat switched, spatial reset,
   *  or the sim was REBUILT under the same chat (brief arrival, rewind) —
   *  writing into the captured world object would bind an orphan. */
  _stale(core, world, gen, chatId) {
    return gen !== PF.spatial._gen || core.chatId !== chatId || core.sim?.world !== world;
  },

  async _sync(core, world, rootLoc) {
    const gen = PF.spatial._gen;
    const chatId = core.chatId;
    // A building is ONE location; its floors are rooms inside it. A zone that is
    // a room stamps mapExport = false (20-world) and is skipped here — it gets no
    // row and no binding. This route is additive with NO delete, so a row posted
    // to a player's real map can never be taken back: the gate belongs on the
    // same side of the release as the zone type that needs it.
    const zoneIds = Object.keys(world.zones).filter(
      (zoneId) => zoneId !== world.startZone && world.zones[zoneId].mapExport !== false,
    );
    let plan = this._plan(world, zoneIds, rootLoc);
    let missing = plan.filter((entry) => entry.create).map((entry) => entry.zoneId);
    let retriesWithoutProgress = 0;
    let attempts = 0;

    // The route caps a batch at 50; worlds are far smaller, but never assume.
    while (missing.length) {
      // Absolute budget: the no-progress counters below compare consecutive
      // iterations, and a live editor can make `missing` OSCILLATE (archiving
      // an adoptable flips a zone back to creation, restoring it flips it
      // again) so consecutive comparisons alone never fire. Every response
      // sequence must terminate.
      if (++attempts > 8) throw new Error("too many export attempts; the map keeps changing");
      const batch = missing.slice(0, 50);
      const res = await PF.api.postSpatialLocations(chatId, {
        expectedRevision: PF.spatial.data.definition.revision,
        locations: batch.map((zoneId) => this._rowFor(world, zoneId, rootLoc)),
      });
      if (this._stale(core, world, gen, chatId)) return;
      if (res.ok) {
        await PF.spatial.refresh(core, { countStale: false });
        if (this._stale(core, world, gen, chatId) || !PF.spatial.available) return;
        const before = missing.length;
        plan = this._plan(world, zoneIds, rootLoc);
        missing = plan.filter((entry) => entry.create).map((entry) => entry.zoneId);
        // An accepted batch whose rows never appear in the re-read (a proxy
        // eating writes, a stale read replica) must not loop forever posting.
        if (missing.length >= before && ++retriesWithoutProgress > 2) {
          throw new Error("accepted locations never appeared in the definition");
        }
        continue;
      }
      const code = res.body?.code;
      if (res.status === 409 && (code === "spatial_definition_stale" || code === "spatial_location_conflict")) {
        // Someone else moved the map (or raced an id in). Re-read and let the
        // diff decide what is still missing; the additive route means nothing
        // of theirs can be harmed by retrying ours. A live editing session can
        // keep moving the revision forever — two no-progress retries and we
        // back off to a later session instead of dueling.
        await PF.spatial.refresh(core, { countStale: false });
        if (this._stale(core, world, gen, chatId) || !PF.spatial.available) return;
        const before = missing.length;
        plan = this._plan(world, zoneIds, rootLoc);
        missing = plan.filter((entry) => entry.create).map((entry) => entry.zoneId);
        // >= not ===: a GROWN missing list (someone archived an adoptable out
        // from under the plan) is regression, not progress.
        if (missing.length >= before && ++retriesWithoutProgress > 2) {
          throw new Error("definition kept moving during export");
        }
        continue;
      }
      if (res.status >= 400 && res.status < 500 && res.status !== 409) {
        // Deliberate refusals — route absent (404), archived/vanished parent,
        // the 500-location cap, disabled maps. These do not heal inside a
        // session, so the world is done here: no bindings to absent locations,
        // no 60-second drumbeat. A rebuild or reload starts fresh.
        this._done.add(world);
        if (res.status !== 404) {
          console.warn(
            `[pixelforge] World Maps export refused (${res.status}${code ? ` ${code}` : ""}); skipping this session`,
          );
        }
        return;
      }
      // 5xx / unclassified: transient — back off and retry within the session.
      throw new Error(`locations route → ${res.status}${code ? ` (${code})` : ""}`);
    }

    // Bind every planned zone — created, adopted, or already present from an
    // earlier session (which self-heals bindings a save may have lost).
    // Bindings are what make travel and drift teleport into these zones.
    let changed = false;
    for (const { zoneId, locId } of plan) {
      if (world.bindings[locId] !== zoneId) {
        world.bindings[locId] = zoneId;
        changed = true;
      }
      const zone = world.zones[zoneId];
      if (zone && zone.spatialLocationId !== locId) {
        zone.spatialLocationId = locId;
        changed = true;
      }
    }
    if (changed) core.markDirty();
    this._failed = null;
    this._done.add(world);
  },
};
