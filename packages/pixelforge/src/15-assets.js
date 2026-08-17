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
  /** The theme the shipped atlas was authored for: Tier-1 art only serves this
   *  theme; every other theme renders procedurally until themed atlases ship. */
  atlasTheme: "cozy-village",
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
    // Never await decode(): Chromium defers decode work indefinitely while the
    // page is hidden (background tab, restored session), which wedged the
    // loader in "loading" forever. The load event fires regardless; the actual
    // pixel decode then happens lazily at first drawImage.
    await new Promise((resolve, reject) => {
      if (img.complete && img.naturalWidth) return resolve();
      img.onload = resolve;
      img.onerror = () => reject(new Error(`image failed to load: ${url}`));
    });
    return img;
  },

  /** The atlas sheet for a theme: the cozy sheet keeps its legacy filename. */
  _atlasPath(theme) {
    return theme === "cozy-village" ? "tiles.png" : `tiles-${encodeURIComponent(theme)}.png`;
  },

  async load(core) {
    const theme = PF.art?.theme ?? "cozy-village";
    if (this.status === "loading") {
      // A theme change landing mid-load must not be dropped (the generation
      // rebuild can call load() while the boot load is still in flight):
      // remember the newest request and chase it once this load settles.
      this._queuedTheme = theme;
      return;
    }
    // The REQUESTED theme is tracked separately from the RESOLVED one: when a
    // theme has no shipped atlas the fallback sheet loads, and without this
    // distinction every props delivery would re-run a 404-fetch + full zone
    // recomposite storm (review finding).
    if (this.status === "ready" && this._requestedTheme === theme) return;
    // No packageId (pre-#5092 engine) is the one terminal state; network
    // failures retry, rate-limited, so a transient outage no longer disables
    // Tier-1 for the whole session (0.3.0 regression fix).
    if (this._noPackage) return;
    if (this.status === "failed" && Date.now() - (this._failedAt ?? 0) < 30_000) return;
    if (typeof core.host?.packageId !== "string") {
      this._noPackage = true;
      this.status = "failed";
      return;
    }
    this._requestedTheme = theme;
    const firstLoad = this.status !== "ready";
    this.status = "loading";
    try {
      if (firstLoad) {
        const [atlas, sprites] = await Promise.all([
          fetch(this._url(core, "atlas.json")).then((r) =>
            r.ok ? r.json() : Promise.reject(new Error(`atlas ${r.status}`)),
          ),
          fetch(this._url(core, "sprites.json")).then((r) =>
            r.ok ? r.json() : Promise.reject(new Error(`sprites ${r.status}`)),
          ),
        ]);
        const sheets = await Promise.all(
          Object.entries(sprites.actors ?? {}).map(async ([name, path]) => [
            name,
            await this._image(this._url(core, path)),
          ]),
        );
        this.atlas = atlas;
        this.sprites = sprites;
        for (const [name, img] of sheets) this._sheets.set(name, img);
      }
      // The themed atlas sheet, falling back to the cozy sheet when a theme has
      // no atlas yet (older installed version) — the tile() gate then simply
      // keeps that theme procedural, which is the deliberate resting state.
      let atlasTheme = theme;
      let atlasImg;
      try {
        atlasImg = await this._image(this._url(core, this._atlasPath(theme)));
      } catch {
        atlasTheme = "cozy-village";
        atlasImg = await this._image(this._url(core, "tiles.png"));
      }
      this._atlasImg = atlasImg;
      this.atlasTheme = atlasTheme;
      this._tileCanvases.clear();
      this.status = "ready";
      // Zone composites were painted with the previous tier/theme — rebuild.
      core.render?.clearZones?.();
      // Chase a theme change that was queued while this load was in flight.
      const queued = this._queuedTheme;
      this._queuedTheme = null;
      if (queued && queued !== theme) void this.load(core);
    } catch (err) {
      this.status = "failed";
      this._failedAt = Date.now();
      this._requestedTheme = null;
      this._queuedTheme = null; // the 30s retry re-reads the live theme anyway
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
    ctx.drawImage(
      sheet,
      frame * frameWidth,
      facing * frameHeight,
      frameWidth,
      frameHeight,
      dx,
      dy,
      frameWidth,
      frameHeight,
    );
    return true;
  },
};
