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

  /** The key a capacity degrade latches under: THIS theme's sheet at THIS
   *  package version. A shipped-artifact mismatch is identical on every retry,
   *  so within the pair the latch is permanent — and a real fix arrives as a
   *  version bump, which is a different key and gets one clean retry. */
  _capacityKey(core, theme) {
    const version = typeof core.host?.packageVersion === "string" ? core.host.packageVersion : "";
    return `${theme}|${version}`;
  },

  /** Does the id map fit inside the sheet that just loaded?
   *
   *  This is the hole in the tier's degradation guarantee, which is per-tile and
   *  CONDITIONAL: `tileCanvas` returns null — and the Tier-0 painter answers —
   *  only for an id the atlas does NOT list. An id the atlas DOES list, against
   *  a sheet too small to hold it, blits an empty in-bounds slot or a no-op
   *  out-of-bounds rect. That is a see-through world rather than procedural art,
   *  and it is exactly what a release that appends tile ids ships if the sheet
   *  goes out un-rebaked.
   *
   *  `naturalHeight`/`naturalWidth`, not `height`/`width`: `_image()` resolves on
   *  the load event without decode(), and the attribute-shadowed pair is not the
   *  pixel one.
   *
   *  BOTH AXES, because the id map declares one of them and the sheet owns the
   *  other. `columns` is the atlas's claim and `tileCanvas` slices at
   *  `index % columns` forever after, so a sheet baked NARROWER than that claim
   *  cuts every id in the missing columns from past its right edge — inside the
   *  row count, invisible to `columns * rows`, and a see-through tile all the
   *  same. The row test cannot catch it and the column test cannot catch a short
   *  sheet, so the guard asks both.
   *
   *  THE HONEST SCOPE, because the guard is narrower than it looks: it catches a
   *  sheet too SMALL for its id map, and that it covers this release at all is
   *  arithmetic luck of the count — 33 ids into 32 slots. Three appended
   *  painters instead of four would have landed in bounds and slipped straight
   *  past it. An aligned-but-stale sheet is busted by the `?v=` cache key
   *  instead, and ids deliberately absent from the atlas keep the per-tile null
   *  path they already had. */
  _overCapacity(img) {
    const tiles = this.atlas?.tiles;
    const size = this.atlas?.tileSize;
    const columns = this.atlas?.columns;
    if (!tiles || !size || !columns) return false;
    const rows = Math.floor(img.naturalHeight / size);
    const sheetColumns = Math.floor(img.naturalWidth / size);
    // A dimension we cannot read is not a mismatch we can prove: leave it alone
    // rather than degrade a working install on a number that never arrived.
    if (!Number.isFinite(rows) || !Number.isFinite(sheetColumns)) return false;
    let maxIndex = -1;
    // INDEX-AWARE on the width too, and deliberately not `sheetColumns < columns`:
    // a narrow sheet whose id map never reaches the missing columns is not a
    // fault, and degrading a working install on one is the false positive that
    // teaches everyone to distrust the guard.
    let pastRightEdge = false;
    for (const index of Object.values(tiles)) {
      if (typeof index !== "number") continue;
      if (index > maxIndex) maxIndex = index;
      if (index % columns >= sheetColumns) pastRightEdge = true;
    }
    return pastRightEdge || maxIndex >= columns * rows;
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
    // The SECOND terminal, and it is `_noPackage`-shaped for the same reason:
    // a sheet that cannot hold its own id map is a shipped artifact, identical
    // on every retry. Sending it to "failed" alone would re-fetch the whole
    // asset set every 30 seconds, forever, on exactly the broken installs.
    if (this._capacityLatch === this._capacityKey(core, theme)) return;
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
      if (this._overCapacity(atlasImg)) {
        this._capacityLatch = this._capacityKey(core, theme);
        this.status = "failed";
        this._requestedTheme = null;
        this._queuedTheme = null;
        this._atlasImg = null;
        this._tileCanvases.clear();
        // The ordinary failure path does NOT evict, and this one has to: a guard
        // firing on the theme-change path would otherwise leave zones already
        // composited from the previous Tier-1 sheet standing beside fresh Tier-0
        // paint, which is a world in two art styles at once.
        core.render?.clearZones?.();
        // Once, because the latch guarantees once.
        console.warn(
          "[pixelforge] the shipped tile sheet is smaller than its own id map; drawing this theme procedurally",
        );
        return;
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
