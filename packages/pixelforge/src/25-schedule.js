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
    // The innkeeper holds the inn all day — it is the fixed point the evening
    // crowd converges on, and it means the lit building is never empty. At night
    // they turn in like anybody else: a brief that homes them AT the inn (the
    // usual shape) puts their bed in the inn's own living quarters, so the
    // building is still occupied and they are simply in it asleep rather than
    // standing among the tables at 3am. One homed at a house down the road walks
    // to it — their guests are still upstairs. With no bed anywhere the handle
    // falls back to `post` and this row behaves exactly as it always did.
    "host:resident": { dawn: "post", day: "post", dusk: "post", night: "home" },
    // The watch keeps the night, so the settlement never looks abandoned.
    "guard:resident": { dawn: "home", day: "post", dusk: "post", night: "post" },
    // Trades work their building through the day and sleep at their dwelling.
    "leader:resident": { dawn: "home", day: "post", dusk: "post", night: "home" },
    "grower:resident": { dawn: "home", day: "post", dusk: "post", night: "home" },
    "maker:resident": { dawn: "home", day: "post", dusk: "post", night: "home" },
    "merchant:resident": { dawn: "home", day: "post", dusk: "post", night: "home" },
    // A travelling trader sleeps at the inn and tends the stall by day.
    "merchant:transient": { dawn: "home", day: "post", dusk: "post", night: "home" },
    // A KEEPER — anyone who holds a building the brief NAMED, whatever their kind.
    // (see the `keeper` flag). Without a row like this the keeper falls to
    // "*:resident" and spends the daylight hours in the plaza, which is exactly
    // when a player opens the church door, so the room built around them would
    // always be empty. Scoped to keepers on purpose: an elder in a settlement with
    // no sanctuary keeps the plaza habits they have always had. Keyed on holding
    // the building rather than on being an elder: which KIND ends up keeping a
    // sanctuary is a question about the kind vocabulary, not about schedules.
    "*:resident:keeper": { dawn: "post", day: "post", dusk: "post", night: "home" },
    // Everyone else with a roof: on their own doorstep at dawn and again at dusk,
    // the square by day, and in bed at night.
    //
    // dawn/dusk are `post` — the apron OUTSIDE their door — not `home`. They used to
    // be `home` and that read correctly while `home` was a one-tile spot at the door.
    // It stopped being true the moment dwellings gained interiors and `home` became a
    // bed inside: residents then vanished indoors from 18:00 to 07:00, which is over
    // half the clock and most of the hours with interesting light. Bed is for night.
    "*:resident": { dawn: "post", day: "public", dusk: "post", night: "home" },
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
    // Most specific first. The `:keeper` tier exists so a template can describe
    // someone who actually holds a building without changing how that same cast
    // kind behaves when they do not.
    const template =
      (sched.keeper ? TABLE[`${sched.kind}:${sched.standing}:keeper`] : null) ??
      (sched.keeper ? TABLE[`*:${sched.standing}:keeper`] : null) ??
      TABLE[`${sched.kind}:${sched.standing}`] ??
      TABLE[`*:${sched.standing}`] ??
      DEFAULT;
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
    // Normalize the corners rather than trusting them. An inverted box makes a
    // span of zero, `hash % 0` is NaN, and standable()'s bounds test is false
    // for every NaN comparison — so a NaN tile would sail out as a valid
    // placement instead of throwing anywhere near the mistake. Nothing produces
    // one today; this is input validation, not a live bug.
    const x0 = Math.min(box.x0, box.x1);
    const x1 = Math.max(box.x0, box.x1);
    const y0 = Math.min(box.y0, box.y1);
    const y1 = Math.max(box.y0, box.y1);
    let cx = ((x0 + x1) / 2) | 0;
    let cy = ((y0 + y1) / 2) | 0;
    const spanX = x1 - x0 + 1;
    const spanY = y1 - y0 + 1;
    // `> 0` is also the non-finite guard: it is false for NaN, which leaves the
    // `| 0`-ed center in place, so no NaN ever reaches standable().
    if (key && spanX > 0 && spanY > 0) {
      const hash = PF.hashStr(String(key));
      cx = x0 + (hash % spanX);
      cy = y0 + (((hash / 7) | 0) % spanY);
    }
    const open = (x, y) => standable(zone, x, y) && !(taken && taken(x, y));
    if (open(cx, cy)) return { x: cx, y: cy };
    /** Deterministic outward ring scan from the start tile, clipped to a rect. */
    const ring = (maxR, lox, hix, loy, hiy) => {
      for (let r = 1; r <= maxR; r++) {
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
            const x = cx + dx;
            const y = cy + dy;
            if (x >= lox && x <= hix && y >= loy && y <= hiy && open(x, y)) return { x, y };
          }
        }
      }
      return null;
    };
    // Sum, not max: an off-center hashed start still has to be able to reach
    // the far corner of the box.
    const inBox = ring(x1 - x0 + (y1 - y0), x0, x1, y0, y1);
    if (inBox) return inBox;
    // The box is FULL. Widen to the zone before giving up. The old fallback
    // dropped straight onto zone.spawn — ONE fixed tile that honours neither
    // `taken` nor standable() — so every NPC overflowing the same box in a
    // single pass landed on top of the last. A household at the CAPS.household
    // cap of 6 shares a 3x2 door apron whose door tile standable() excludes, so
    // it overflowed on every seed tried, and the losers were both un-talkable
    // (nearest wins on a strict <) and frozen: their wander box is the very box
    // they could not fit in, so every candidate step fails its bounds test.
    // Standing just outside it is the honest outcome — spare, but reachable.
    //
    // Clamp the scan origin into the zone first, or a box sitting outside the
    // map would need a radius bigger than w+h just to reach tile 0 and the
    // "whole zone" pass would quietly cover none of it.
    cx = PF.clamp(cx, 0, zone.w - 1) | 0;
    cy = PF.clamp(cy, 0, zone.h - 1) | 0;
    const inZone = ring(zone.w + zone.h, 0, zone.w - 1, 0, zone.h - 1);
    if (inZone) return inZone;
    // Every standable tile in the zone is occupied. Nothing can satisfy both
    // predicates now, so drop the one that is merely undesirable and keep the
    // one that is structural: sharing a tile looks wrong, standing inside a wall
    // or in a doorway IS wrong, and a doorway blocks the way in. Returning the
    // spawn unchecked (as this did) could do exactly that, so check it — it is
    // the tile every zone guarantees walkable, and was standable in all 480
    // compiled zones tried, but the guarantee should live in the code.
    //
    // Unreachable in practice, and deliberately not escalated to a null return:
    // the smallest zone measured holds 119 standable tiles against a cast capped
    // at 10, so this is a floor under a contract, not a live path.
    if (standable(zone, zone.spawn.x, zone.spawn.y)) return { x: zone.spawn.x, y: zone.spawn.y };
    for (let y = 0; y < zone.h; y++) {
      for (let x = 0; x < zone.w; x++) if (standable(zone, x, y)) return { x, y };
    }
    return { x: zone.spawn.x, y: zone.spawn.y };
  }

  return { TABLE, resolve, walkableIn, standable };
})();
