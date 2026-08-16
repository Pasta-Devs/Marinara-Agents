// ── World Maps export (spec §8): register generated zones as locations ────────
// The compiled world's zones become children of the location the exterior is
// bound to, through the additive locations route (World Maps 1.4.0). The map
// definition itself is the idempotency ledger: location ids are seed-stable
// (pf.<hash(seed)>.<zoneId>), diffed against definition.locations before
// posting, so a re-run — new session, rebuild from the same brief — adds
// nothing and merely re-binds. Everything degrades quietly: no hierarchical
// map, an older maps package without the route, or an archived parent all
// mean "the world runs on package state alone", never a nag.
PF.mapsExport = {
  _doneKey: null,
  _inFlight: false,
  _failed: null, // {key, at} — 60s backoff so per-turn refreshes don't hammer a failing route

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
    // The exterior must already be bound (refresh seeds that on first sight);
    // its location is the parent every exported zone hangs under.
    const rootLoc = Object.keys(world.bindings).find((loc) => world.bindings[loc] === world.startZone);
    if (!rootLoc) return;
    const key = `${core.chatId}:${this._hash(String(world.seed))}`;
    if (this._inFlight || this._doneKey === key) return;
    if (this._failed?.key === key && Date.now() - this._failed.at < 60000) return;
    this._inFlight = true;
    try {
      await this._sync(core, world, rootLoc, key);
    } catch (err) {
      this._failed = { key, at: Date.now() };
      console.warn("[pixelforge] World Maps export failed", err);
    } finally {
      this._inFlight = false;
    }
  },

  _existingIds() {
    const locations = PF.spatial.data?.definition?.locations;
    return new Set(Array.isArray(locations) ? locations.map((location) => location.id) : []);
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

  async _sync(core, world, rootLoc, key) {
    // Chat-switch guard: same generation discipline refresh() uses — a switch
    // mid-await must never write into the new chat's world or map.
    const gen = PF.spatial._gen;
    const chatId = core.chatId;
    const zoneIds = Object.keys(world.zones).filter((zoneId) => zoneId !== world.startZone);
    let existing = this._existingIds();
    let missing = zoneIds.filter((zoneId) => !existing.has(this.idFor(world, zoneId)));
    let retriesWithoutProgress = 0;

    // The route caps a batch at 50; worlds are far smaller, but never assume.
    while (missing.length) {
      const batch = missing.slice(0, 50);
      const res = await PF.api.postSpatialLocations(chatId, {
        expectedRevision: PF.spatial.data.definition.revision,
        locations: batch.map((zoneId) => this._rowFor(world, zoneId, rootLoc)),
      });
      if (gen !== PF.spatial._gen || core.chatId !== chatId) return;
      if (res.ok) {
        await PF.spatial.refresh(core, { countStale: false });
        if (gen !== PF.spatial._gen || core.chatId !== chatId || !PF.spatial.available) return;
        existing = this._existingIds();
        missing = missing.filter((zoneId) => !existing.has(this.idFor(world, zoneId)));
        continue;
      }
      if (res.status === 404) {
        // Older maps package without the locations route — a mode, not a failure.
        this._doneKey = key;
        return;
      }
      const code = res.body?.code;
      if (res.status === 409 && (code === "spatial_definition_stale" || code === "spatial_location_conflict")) {
        // Someone else moved the map (or raced an id in). Re-read and let the
        // diff decide what is still missing; the additive route means nothing
        // of theirs can be harmed by retrying ours. A live editing session can
        // keep moving the revision forever — two no-progress retries and we
        // back off to a later session instead of dueling.
        await PF.spatial.refresh(core, { countStale: false });
        if (gen !== PF.spatial._gen || core.chatId !== chatId || !PF.spatial.available) return;
        const before = missing.length;
        existing = this._existingIds();
        missing = missing.filter((zoneId) => !existing.has(this.idFor(world, zoneId)));
        if (missing.length === before && ++retriesWithoutProgress > 2) {
          throw new Error("definition kept moving during export");
        }
        continue;
      }
      // Archived parent (400), disabled maps, or anything else: back off and
      // let a later session try again. The world plays on regardless.
      throw new Error(`locations route → ${res.status}${code ? ` (${code})` : ""}`);
    }

    // Bind every exported zone — including ids already present from an earlier
    // session, which self-heals bindings a save may have lost. Bindings are
    // what make travel and drift-following teleport into these zones.
    let changed = false;
    for (const zoneId of zoneIds) {
      const locId = this.idFor(world, zoneId);
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
    this._doneKey = key;
  },
};
