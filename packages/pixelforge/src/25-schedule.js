// ── NPC daypart schedules ────────────────────────────────────────────────────
// Who is where, when. The compiler (20-world) bakes a `_sched` onto every NPC
// holding pre-computed location HANDLES — geometry can only be built while the
// buildings/stalls/zones are still in scope. This module owns the POLICY: a
// small table of kind×standing -> daypart -> handle name, resolved at runtime
// by the Sim as the clock crosses a daypart boundary.
//
// Deliberately sparse. A combo with nothing interesting to do names only
// "post", so it behaves exactly as it did before schedules existed — standing
// at its anchor around the clock. Any handle a template names that an NPC does
// not have (no dwelling, no inn) falls back to `post`, so a template can never
// strand an NPC nowhere.
//
// Schedules add ZERO save fields: they are a pure function of the clock, which
// is already saved, so a restored chat re-resolves to the right daypart and a
// timeline rewind rewinds the town with it.
PF.schedule = (() => {
  // Handle names: post = the working/day anchor, home = the sleep node,
  // public = the settlement's plaza. See 20-world's cast loop for the geometry.
  const TABLE = {
    // The innkeeper never leaves the inn — it is the fixed point the evening
    // crowd converges on, and it means the lit building is never empty.
    "host:resident": { dawn: "post", day: "post", dusk: "post", night: "post" },
    // The watch keeps the night, so the settlement never looks abandoned.
    "guard:resident": { dawn: "home", day: "post", dusk: "post", night: "post" },
    // Trades work their building through the day and sleep at their dwelling.
    "leader:resident": { dawn: "home", day: "post", dusk: "post", night: "home" },
    "grower:resident": { dawn: "home", day: "post", dusk: "post", night: "home" },
    "maker:resident": { dawn: "home", day: "post", dusk: "post", night: "home" },
    "merchant:resident": { dawn: "home", day: "post", dusk: "post", night: "home" },
    // A travelling trader sleeps at the inn and tends the stall by day.
    "merchant:transient": { dawn: "home", day: "post", dusk: "post", night: "home" },
    // Everyone else with a roof: at the door at dawn, the square by day (the
    // plaza should feel busiest in daylight and empty after dark), home at night.
    "*:resident": { dawn: "home", day: "public", dusk: "home", night: "home" },
    // Loiterers hold their public spot all day and take a bed at night.
    "*:transient": { dawn: "post", day: "post", dusk: "post", night: "home" },
    // Fringe NPCs stay out at the margins — meeting one means going to them.
    "*:fringe": { dawn: "post", day: "post", dusk: "post", night: "post" },
    // No bed to go to: the square, day and night.
    "*:destitute": { dawn: "post", day: "post", dusk: "post", night: "post" },
  };
  const DEFAULT = { dawn: "post", day: "post", dusk: "post", night: "post" };

  /** The handle an NPC should occupy at this daypart, or null when unscheduled. */
  function resolve(sched, daypart) {
    if (!sched) return null;
    const template = TABLE[`${sched.kind}:${sched.standing}`] ?? TABLE[`*:${sched.standing}`] ?? DEFAULT;
    return sched[template[daypart] ?? "post"] ?? sched.post ?? null;
  }

  /** Can an NPC STAND here? Open ground is not enough: a door tile is
   *  deliberately non-solid (the player walks through it) and a portal tile is
   *  the zone's exit, so an NPC parked on either looks wrong and blocks the way
   *  in. Player movement is unaffected — this gates NPCs only. */
  function standable(zone, x, y) {
    if (x < 0 || x >= zone.w || y < 0 || y >= zone.h) return false;
    const index = y * zone.w + x;
    if (zone.solid[index]) return false;
    if (zone.object[index] === "door") return false;
    for (const portal of zone.portals) if (portal.x === x && portal.y === y) return false;
    return true;
  }

  /** An open tile inside the box, nudged off anything solid — the runtime twin
   *  of the compiler's walkableSpawn, so a relocation can never drop an NPC
   *  inside a wall or a tree. Deterministic: consumes no randomness.
   *
   *  `key` spreads a SHARED box. Most residents resolve to the same `public`
   *  handle by day and a household shares one `home`, so a plain box-center
   *  placement stacked the cast onto a single tile — and because talk-targeting
   *  picks the nearest with a strict <, everyone under the top sprite became
   *  unreachable. A stable per-NPC hash picks each one its own starting tile.
   *
   *  `taken` is the caller's occupancy test. The hash alone only SPREADS: two
   *  ids can still land on the same tile in a small box (a household door
   *  apron is six tiles), which puts us right back on the unreachable sprite.
   *  Treating an occupied tile as closed makes the ring scan walk to the next
   *  free one, so "no two NPCs on a tile" is an invariant rather than a
   *  probability. Still deterministic: occupancy is a function of the order
   *  the caller places its NPCs in, which is itself fixed. */
  function walkableIn(zone, box, key, taken) {
    let cx = ((box.x0 + box.x1) / 2) | 0;
    let cy = ((box.y0 + box.y1) / 2) | 0;
    if (key) {
      const spanX = box.x1 - box.x0 + 1;
      const spanY = box.y1 - box.y0 + 1;
      const hash = PF.hashStr(String(key));
      cx = box.x0 + (hash % spanX);
      cy = box.y0 + (((hash / 7) | 0) % spanY);
    }
    const open = (x, y) => standable(zone, x, y) && !(taken && taken(x, y));
    if (open(cx, cy)) return { x: cx, y: cy };
    // Sum, not max: an off-center hashed start still has to be able to reach
    // the far corner of the box.
    const maxR = box.x1 - box.x0 + (box.y1 - box.y0);
    for (let r = 1; r <= maxR; r++) {
      for (let dy = -r; dy <= r; dy++) {
        for (let dx = -r; dx <= r; dx++) {
          if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
          const x = cx + dx;
          const y = cy + dy;
          if (x >= box.x0 && x <= box.x1 && y >= box.y0 && y <= box.y1 && open(x, y)) return { x, y };
        }
      }
    }
    return { x: zone.spawn.x, y: zone.spawn.y };
  }

  return { TABLE, resolve, walkableIn, standable };
})();
