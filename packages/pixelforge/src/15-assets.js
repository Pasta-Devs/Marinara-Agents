// ── Tier-1 asset loader ───────────────────────────────────────────────────────
// Loads the authored atlas + sprite sheets shipped as package assets
// (contributions.assets, Capability API 1.10). Every draw resolves
// Tier1 ?? Tier0, so a missing/failed load (older engine without the assets
// route, network trouble, corrupted file → 404) leaves the game fully playable
// on procedural art. Uses the packageId/packageVersion the host injects into
// capabilityProps; ?v= keys the browser cache per version (assets revalidate
// with ETags — never immutable).
PF.assets = {
  status: "idle", // idle | loading | ready | failed
  atlas: null, // {tileSize, columns, tiles: {id: index}}
  sprites: null, // {frameWidth, frameHeight, frames, rows, actors: {name: path}}
  _atlasImg: null,
  _sheets: new Map(), // actor name → HTMLImageElement
  _tileCanvases: new Map(),

  _url(core, path) {
    const id = typeof core.host?.packageId === "string" ? core.host.packageId : "pixelforge";
    const version = typeof core.host?.packageVersion === "string" ? core.host.packageVersion : null;
    return `/api/capability-packages/${encodeURIComponent(id)}/assets/${path}${
      version ? `?v=${encodeURIComponent(version)}` : ""
    }`;
  },

  async _image(url) {
    const img = new Image();
    img.src = url;
    await img.decode();
    return img;
  },

  async load(core) {
    if (this.status === "loading" || this.status === "ready") return;
    // packageId arrives via capabilityProps on engines with #5092; without it
    // (older engine) Tier-0 is the deliberate resting state, not an error.
    if (typeof core.host?.packageId !== "string") {
      this.status = "failed";
      return;
    }
    this.status = "loading";
    try {
      const [atlas, sprites] = await Promise.all([
        fetch(this._url(core, "atlas.json")).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`atlas ${r.status}`)))),
        fetch(this._url(core, "sprites.json")).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`sprites ${r.status}`)))),
      ]);
      const [atlasImg, ...sheets] = await Promise.all([
        this._image(this._url(core, "tiles.png")),
        ...Object.entries(sprites.actors ?? {}).map(async ([name, path]) => [name, await this._image(this._url(core, path))]),
      ]);
      this.atlas = atlas;
      this.sprites = sprites;
      this._atlasImg = atlasImg;
      for (const [name, img] of sheets) this._sheets.set(name, img);
      this.status = "ready";
      // Zone composites were painted with Tier-0 tiles — rebuild them.
      if (core.render && core.sim) for (const zoneId of Object.keys(core.sim.world.zones)) core.render.invalidateZone(zoneId);
    } catch (err) {
      this.status = "failed";
      console.warn("[pixelforge] Tier-1 assets unavailable, staying on procedural art", err);
    }
  },

  /** Tier-1 tile as a canvas, or null → caller falls back to Tier-0. */
  tileCanvas(id) {
    if (this.status !== "ready") return null;
    const index = this.atlas.tiles[id];
    if (index === undefined) return null;
    let c = this._tileCanvases.get(id);
    if (c) return c;
    const size = this.atlas.tileSize;
    c = PF.offscreen(size, size);
    const g = c.getContext("2d");
    g.imageSmoothingEnabled = false;
    g.drawImage(
      this._atlasImg,
      (index % this.atlas.columns) * size,
      Math.floor(index / this.atlas.columns) * size,
      size,
      size,
      0,
      0,
      size,
      size,
    );
    this._tileCanvases.set(id, c);
    return c;
  },

  /** Draw a Tier-1 actor frame; returns false → caller falls back to Tier-0. */
  drawActor(ctx, key, facing, phase, moving, dx, dy) {
    if (this.status !== "ready") return false;
    const sheet = this._sheets.get(key);
    if (!sheet || !this.sprites) return false;
    const { frameWidth, frameHeight, frames } = this.sprites;
    const frame = moving ? Math.floor(phase) % frames : 0;
    ctx.drawImage(sheet, frame * frameWidth, facing * frameHeight, frameWidth, frameHeight, dx, dy, frameWidth, frameHeight);
    return true;
  },
};
