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
    // SOMEBODY THE BRIEF PLACED BY NAME (see the `worker` flag — a resolved
    // `workplace`). Without a row like this the binding inverts itself exactly
    // where it was supposed to help: half the cast kinds have no row of their own,
    // so an acolyte or a shop assistant falls to "*:resident", whose DAY entry is
    // the plaza — they would hold the building they were assigned to at dawn and
    // dusk and then leave it for the eleven hours of daylight a player is most
    // likely to open the door.
    //
    // Keyed on being named rather than on a kind, for the same reason the keeper
    // tier is keyed on holding a building: it says nothing about WHO someone is,
    // only that the brief already answered where they are. Night is still `home`,
    // because a day job has no opinion about a bed.
    //
    // BELOW the per-kind rows, deliberately. This tier exists for the SIX kinds
    // that have no row at all; a kind that has one already spends its day at
    // `post`, and `post` is the named workplace by the time this resolves — so
    // the kind row and the workplace agree without this row's help. Placing it
    // above them broke exactly the one row that disagrees on purpose: a guard
    // given a workplace stopped keeping the night watch, because this row sends
    // everybody home at night and "the watch keeps the night, so the settlement
    // never looks abandoned" is the whole point of `guard:resident`.
    "*:resident:worker": { dawn: "post", day: "post", dusk: "post", night: "home" },
    // Everyone else with a roof: on their own doorstep at dawn and again at dusk,
    // the square by day, and in bed at night.
    //
    // dawn/dusk are `post` — the apron OUTSIDE their door — not `home`. They used to
    // be `home` and that read correctly while `home` was a one-tile spot at the door.
    // It stopped being true the moment dwellings gained interiors and `home` became a
    // bed inside: residents then vanished indoors from 18:00 to 07:00, which is over
    // half the clock and most of the hours with interesting light. Bed is for night.
    // DAWN AND DUSK BELONG TO THE HEARTH. Both used to be `post`, so an ordinary
    // resident stood at their work anchor from waking until sleeping and the only
    // thing a whole day did was empty the houses at noon. A household is in and
    // around the fire at first light and again at last light, which is also what
    // makes a lit window at dusk mean somebody is behind it.
    //
    // `resolve` falls back to `post` when an NPC has no `hearth` handle, so
    // anyone with no fire to stand at — a wilds resident, a lodger in a named
    // place's quarters — keeps exactly the day they had.
    "*:resident": { dawn: "hearth", day: "public", dusk: "hearth", night: "home" },
    // Loiterers hold their public spot all day and take a bed at night.
    "*:transient": { dawn: "post", day: "post", dusk: "post", night: "home" },
    // Fringe NPCs stay out at the margins — meeting one means going to them.
    "*:fringe": { dawn: "post", day: "post", dusk: "post", night: "post" },
    // No bed to go to: the square, day and night.
    "*:destitute": { dawn: "post", day: "post", dusk: "post", night: "post" },
  };
  const DEFAULT = { dawn: "post", day: "post", dusk: "post", night: "post" };

  /** The handle an NPC should occupy at this daypart, or null when unscheduled.
   *
   *  `bias` IS THE WEATHER, and it is optional: `{ indoor(zoneId) }`, handed in
   *  by the sim (which owns zones) only on a day whose word carries
   *  `WORD_META.indoors` — rain, storm and snow. INTENSITY NEVER REACHES IT:
   *  light rain empties the street exactly as heavy rain does, because a drizzle
   *  reads as weather and not as an exception.
   *
   *  What it does, in one sentence: anybody the policy has standing OUTDOORS on
   *  a wet day is sent to their own fireside instead. Three rules, in order:
   *
   *  1. EXEMPT WHEN THE POLICY NAMES WORK FOR THIS HOUR (`post`). The watch keeps
   *     the night, a grower works the land in the rain, keepers and named workers
   *     hold their posts, a stall merchant tends the stall. The test reads the
   *     policy NAME and never an NPC's identity — there is no "is this the public
   *     handle" question anywhere in here. Coarse in BOTH directions, and stated
   *     rather than papered over: the cast data holds no outdoor-job flag, so an
   *     outdoor-posted scholar is exempt exactly like the shepherd — and `post`
   *     is also the compiler's fallback anchor for somebody with no job at all,
   *     who therefore stands out in the plaza the bias is emptying. Which side of
   *     the line a fallback post belongs on is a felt-behaviour question the
   *     maintainer meets in play, not one this table can answer.
   *  2. ALREADY INDOORS -> there is nothing to do.
   *  3. ELSE SUBSTITUTE THE ROW'S OWN DUSK ANCHOR, and only then its night one.
   *     Dusk first because a resident's DAYLIGHT indoors is their fireside and
   *     not their bed: substituting the night name parks the whole town on its
   *     own bunks at noon, which is the compiler's own rejected visual (see
   *     20-world's bedBox comment). Both are RAW lookups, deliberately without
   *     this function's `?? sched.post` tail — post is outdoors, and outdoors is
   *     the thing being escaped. A hearth-less lodger's dusk name resolves null
   *     and they fall to their berth; somebody with neither keeps the handle they
   *     had, because nowhere to go is answered by standing in the weather and not
   *     by teleporting nowhere.
   *
   *  CAPACITY-NEUTRAL BY CONSTRUCTION. Every destination this can pick is one the
   *  DUSK or the NIGHT pass already assigns that same NPC, every evening of the
   *  world's life — same zone, same box, same walkableIn spread. No box receives
   *  an occupant it does not already hold, so there is no capacity term, no spill
   *  ladder and no concentration to mitigate: the wet 07:00 pass is the dusk
   *  relocation run early.
   *
   *  AND AT NIGHT IT IS A NO-OP BECAUSE OF WHERE THE DESTINATIONS ARE, not
   *  because the table walk cannot happen. The reason to state it that way is
   *  that the walk DOES happen: rule 3 is entered whenever a night name resolves
   *  to something outdoors, and on real worlds that is somebody with no `home`
   *  handle at all — a wilds resident, a lodger nobody laid a bed for — whose
   *  night name falls through to `sched.post` (measured over 960 compiled worlds,
   *  both themes and all four scales: 244 night resolutions reach the loop). They
   *  find no indoor anchor either, because a `post` outdoors means the compiler
   *  resolved no hearth for them, so they keep the handle they had.
   *
   *  What makes the pass a no-op is the compiler's own guarantee: IT NEVER MINTS
   *  AN OUTDOOR `home` HANDLE. Every one is a bed box inside a dwelling interior
   *  or an inn berth (same 960 worlds: 50,832 home handles, zero outdoors), so
   *  anybody who HAS one is already indoors at night and rule 2 answers first.
   *  Hand-force the shape the compiler will not mint — an outdoor `home` beside
   *  an indoor anchor — and rule 3 fires at night through the DUSK rung exactly
   *  as it does at noon; the harness does precisely that (case 14j) and watches
   *  the household head walk into the building they work in. The invariant is
   *  that the destinations are indoors, and nothing else.
   *
   *  ONE COLLISION WORTH KNOWING ABOUT, since those 244 are all of it: when the
   *  night handle IS the `post` fallback and the row's dusk name is also `post`,
   *  the loop's first rung re-tests the handle rule 2 has just rejected. Wasted,
   *  never wrong — `bias.indoor` is pure and the second rung still gets its
   *  turn — and cheaper to leave than to special-case. */
  function resolve(sched, daypart, bias) {
    if (!sched) return null;
    // Most specific first. The `:keeper` tier exists so a template can describe
    // someone who actually holds a building without changing how that same cast
    // kind behaves when they do not.
    const template =
      (sched.keeper ? TABLE[`${sched.kind}:${sched.standing}:keeper`] : null) ??
      (sched.keeper ? TABLE[`*:${sched.standing}:keeper`] : null) ??
      (sched.worker ? TABLE[`${sched.kind}:${sched.standing}:worker`] : null) ??
      TABLE[`${sched.kind}:${sched.standing}`] ??
      (sched.worker ? TABLE[`*:${sched.standing}:worker`] : null) ??
      TABLE[`*:${sched.standing}`] ??
      DEFAULT;
    const name = template[daypart] ?? "post";
    const handle = sched[name] ?? sched.post ?? null;
    if (!bias || name === "post" || !handle || bias.indoor(handle.zoneId)) return handle;
    for (const key of [template.dusk ?? "post", template.night ?? "post"]) {
      // Named for what it is and never `shelter`: one release ago `world.shelter`
      // was a different thing entirely, and it was deleted.
      const indoorAnchor = sched[key];
      if (indoorAnchor && bias.indoor(indoorAnchor.zoneId)) return indoorAnchor;
    }
    return handle;
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
    // single pass landed on top of the last. A household of six shares a 3x2 door
    // apron whose door tile standable() excludes, so
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
    // the smallest zone measured holds 119 standable tiles, comfortably more
    // than any one zone's occupants even now that the mint fills a city (see
    // npcOccupies in 30-sim.js for the measured population numbers), so this is
    // a floor under a contract, not a live path.
    if (standable(zone, zone.spawn.x, zone.spawn.y)) return { x: zone.spawn.x, y: zone.spawn.y };
    for (let y = 0; y < zone.h; y++) {
      for (let x = 0; x < zone.w; x++) if (standable(zone, x, y)) return { x, y };
    }
    return { x: zone.spawn.x, y: zone.spawn.y };
  }

  return { TABLE, resolve, walkableIn, standable };
})();
