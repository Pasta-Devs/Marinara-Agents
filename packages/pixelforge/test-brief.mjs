// Standalone harness for the brief validator (node test-brief.mjs): shims the
// PF prelude globals, loads the non-DOM modules, and drives the repair passes,
// compiler invariants, injection metering, and spatial-binding regressions
// through the spec's degenerate cases (docs/brief-schema.md §4-5, §7).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
// Mirror the real bundle: concatenate the modules into one scope (the prelude
// declares `const PF` itself) and return PF. The DOM helpers stay unused.
const source = [
  "00-prelude.js",
  "10-art.js",
  "15-assets.js",
  "18-brief.js",
  "20-world.js",
  "25-schedule.js",
  "30-sim.js",
  "50-spatial.js",
  "55-maps-export.js",
  "60-save.js",
]
  .map((file) => readFileSync(join(here, "src", file), "utf8"))
  .join("\n");
const loadedPF = new Function(`"use strict";\n${source}\nreturn PF;`)();
// refresh() fire-and-forgets the maps export; without a stub every earlier
// spatial case would hit undefined fetch and warn. 404 = "route absent" is the
// quiet-skip mode, exactly right as a default. Export cases override it.
loadedPF.api.postSpatialLocations = async () => ({ ok: false, status: 404, body: null });
const { brief, world } = loadedPF;
const ctx = { theme: "cozy-village", seed: 424242 };

// 1. The farm-village conversation case: 30 people, structured as households.
{
  const sealed = brief.validate(
    {
      scale: "village", name: "Mossbrook", backgroundPopulation: 30,
      situation: "Mayor Alder is hiding the survey that says the north field is sinking.",
      cast: [
        { name: "Alder Vance", role: "mayor", kind: "leader", tint: "blue", home: "Mossbrook", household: 1 },
        { name: "Nessa Vance", role: "daughter", kind: "folk", tint: "violet", home: "Mossbrook", household: 1 },
        { name: "Perrin Quill", role: "innkeep", kind: "host", tint: "amber", home: "Mossbrook", household: 2 },
        { name: "Old Sera", role: "weaver", kind: "elder", tint: "rose", home: "Mossbrook", household: 3 },
        { name: "Brint", role: "farmhand", kind: "grower", tint: "green", home: "Mossbrook", household: 4 },
        { name: "Marla", role: "farmhand", kind: "grower", tint: "teal", home: "Mossbrook", household: 4 },
      ],
    },
    ctx,
  );
  const households = new Set(sealed.cast.map((c) => c.household));
  assert.equal(households.size, 4, "six people in four households — never thirty houses");
  assert.equal(sealed.backgroundPopulation, 30, "population is texture, preserved");
  assert.ok(sealed.situation.includes("Alder"), "the hook survives");
  assert.ok(sealed._ids.zones.z1 === "Mossbrook" && sealed._ids.cast.n1 === "Alder Vance", "ids assigned");
}

// 2. scale as a population number (the observed weak-model slip).
{
  const sealed = brief.validate({ scale: 30, name: "Testton", cast: [] }, ctx);
  assert.equal(sealed.scale, "village", "numeric scale bucketed");
  assert.ok(sealed._repairs.some((r) => r.includes("bucketed")), "repair logged");
}

// 3. Degenerate-but-valid: one household, one zone, all-grey tints, tiny cast.
{
  const sealed = brief.validate(
    {
      scale: "hamlet", name: "Greyfold",
      cast: [
        { name: "A", kind: "folk", tint: "grey", home: "Greyfold", household: 1 },
        { name: "B", kind: "folk", tint: "grey", home: "Greyfold", household: 1 },
      ],
    },
    ctx,
  );
  assert.ok(sealed.cast.length >= 4, "cast floored to minimum");
  assert.ok(new Set(sealed.cast.map((c) => c.household)).size >= 2, "single household split");
  assert.ok(new Set(sealed.cast.map((c) => c.tint)).size >= 3, "tints rotated for legibility");
  assert.ok(sealed.places.length >= 1, "zone floor synthesized a wilds");
}

// 4. Transport: object-keyed cast, markdown junk, oversized household ids.
{
  const sealed = brief.validate(
    {
      scale: "village", name: "**Objton**",
      cast: {
        a: { name: "`One`", kind: "folk", tint: "red", home: "Objton", household: 99 },
        b: { name: "<b>Two</b>", kind: "folk", tint: "blue", home: "nowhere", household: 0 },
        c: { name: "Three", kind: "definitely-not-a-kind", tint: "chartreuse", home: "Objton", household: 2 },
        d: { name: "Four", kind: "guard", tint: "teal", home: "OBJTON", household: 3 },
      },
    },
    ctx,
  );
  assert.equal(sealed.name, "Objton", "markdown stripped from names");
  assert.equal(sealed.cast[0].name, "One", "backticks stripped");
  assert.equal(sealed.cast[0].household, 6, "household clamped to cap");
  assert.equal(sealed.cast[1].home, "Objton", "unresolved home falls to root");
  assert.equal(sealed.cast[2].kind, "folk", "unknown kind folds to folk");
  assert.ok(Object.keys(brief.TINTS).includes(sealed.cast[2].tint), "unknown tint replaced from the enum");
  assert.equal(sealed.cast[3].home, "Objton", "folded home resolution (case)");
}

// 5. Caps: too many places, duplicate names, unknown feature tags drop whole items.
{
  const sealed = brief.validate(
    {
      scale: "town", name: "Capston",
      features: [
        { tag: "crop-plots", name: "Plots" },
        { tag: "not-a-tag", name: "Ghost" },
        { tag: "dense-growth", name: "WrongZone" }, // wilds-only tag in the settlement
      ],
      places: [
        { kind: "wilds", name: "Wood" }, { kind: "wilds", name: "Wood" }, { kind: "wilds", name: "Wood3" },
        { kind: "hall", name: "Hall A" }, { kind: "hall", name: "Hall B" }, { kind: "gathering", name: "Inn" },
      ],
      cast: [
        { name: "X", kind: "folk", tint: "red", home: "Wood", household: 1 },
        { name: "Y", kind: "folk", tint: "blue", home: "Capston", household: 2 },
        { name: "Z", kind: "folk", tint: "green", home: "Capston", household: 3 },
        { name: "W", kind: "folk", tint: "amber", home: "Capston", household: 4 },
      ],
    },
    ctx,
  );
  assert.equal(sealed.features.length, 1, "unknown and wrong-zone feature items dropped whole");
  assert.equal(sealed.places.filter((p) => p.kind === "wilds").length, 2, "wilds capped at 2");
  assert.equal(sealed.places.filter((p) => p.kind === "hall").length, 1, "hall capped at 1");
  const names = sealed.places.map((p) => p.name);
  assert.equal(new Set(names.map((n) => n.toLowerCase())).size, names.length, "duplicate zone names deduped");
}

// 6. Determinism: same input + seed -> byte-identical sealed brief; different seed -> different repairs.
{
  const degenerate = { scale: "hamlet", name: "Detton", cast: [] };
  const a = JSON.stringify(brief.validate(degenerate, ctx));
  const b = JSON.stringify(brief.validate(degenerate, ctx));
  assert.equal(a, b, "validate is deterministic for a given seed");
  // Bounded-enum picks can collide between two PARTICULAR seeds, so require
  // only that some nearby seed diverges — non-probabilistic across the set.
  const variants = [7, 8, 9, 10, 11].map((seed) => JSON.stringify(brief.validate(degenerate, { ...ctx, seed })));
  assert.ok(variants.some((v) => v !== a), "top-ups derive from the seed");
}

// 7. Defaults: both themes produce valid sealed briefs with the known casts.
{
  for (const theme of ["cozy-village", "sci-fi-colony"]) {
    const sealed = brief.defaults(theme, 424242);
    assert.equal(sealed.theme, theme);
    assert.ok(sealed.cast.length >= 4);
    assert.ok(sealed.places.some((p) => p.kind === "gathering"), `${theme} default has a gathering place`);
    assert.ok(JSON.stringify(sealed).length <= 8_192, "default brief inside the byte budget");
  }
}

// 8. Non-Latin names survive: caps are grapheme-based, folding resolves homes, ids carry identity.
{
  const sealed = brief.validate(
    {
      scale: "village", name: "囲炉裏の村",
      places: [{ kind: "gathering", name: "琥珀の炉亭" }],
      cast: [
        { name: "ミラ", kind: "host", tint: "rose", home: "琥珀の炉亭", household: 1 },
        { name: "タム", kind: "grower", tint: "green", home: "囲炉裏の村", household: 2 },
        { name: "ルーク", kind: "guard", tint: "blue", home: "囲炉裏の村", household: 3 },
        { name: "フェン", kind: "wanderer", tint: "teal", home: "囲炉裏の村", household: 4 },
      ],
    },
    ctx,
  );
  assert.equal(sealed.name, "囲炉裏の村", "non-Latin settlement name intact");
  assert.equal(sealed.cast[0].home, "琥珀の炉亭", "non-Latin home resolution works");
  assert.equal(sealed._ids.zones.z2, "琥珀の炉亭", "identity is ordinal ids, never slugs");
}

// 9. Guidance and schema stay within their budgets.
{
  const text = brief.guidance("sci-fi-colony");
  assert.ok(text.length < 4_000, `guidance stays compact (${text.length} chars)`);
  assert.ok(text.includes("AUTHORITATIVE"), "theme-authority line present");
  assert.ok(text.includes("do NOT list one household per person"), "household teaching line present");
  assert.ok(text.includes("standing"), "standing teaching line present");
  const schemaStr = JSON.stringify(brief.schema());
  assert.ok(schemaStr.length <= 8_000, "schema fits the route's cap");
  assert.ok(schemaStr.includes("destitute"), "schema exposes the standing enum");
}

// ── Compiler invariants (compile(sealedBrief, seed)) ─────────────────────────
// The tiles an NPC can be asleep on. A bunk is a bed TYPE, not a second kind of
// furniture with its own rules, so anything asserting "in bed" names both.
const SLEEPS_ON = new Set(["bed", "bunk"]);
// A BUILDING is its ground floor plus whatever floors it grew (0.8.0). Floor ids
// derive from the parent's — `{id}u` above, `{id}b` below — so "everywhere under
// this roof" is a question about ids and needs no bookkeeping to answer.
const floorIds = (w, zoneId) => [zoneId, `${zoneId}u`, `${zoneId}b`].filter((id) => w.zones[id]);
const floorsOf = (w, zoneId) => floorIds(w, zoneId).map((id) => w.zones[id]);
/** Everyone anywhere in a building, tagged with the floor they are standing on. */
const underRoof = (w, zoneId) => floorsOf(w, zoneId).flatMap((zone) => zone.npcs.map((npc) => ({ zone, npc })));
/** The floor a building's sleeping rooms are on: the storey when it grew one,
 *  the ground floor when it did not (0.8.0 floors). Cases about BEDROOMS ask
 *  this rather than naming a floor, so one assertion covers both sides of the
 *  upper-storey gate. */
const bedFloor = (w, zone) => {
  const up = w.zones[`${zone.id}u`];
  return up && up.beds.length ? up : zone;
};
/** The ground floor of whatever floor an id names. Every ground zone id ends in a
 *  digit (`z2`, `h1`, `s4`), so a trailing `u`/`b` can only be a floor suffix. */
const groundFloorId = (zoneId) => (/[ub]$/.test(zoneId) ? zoneId.slice(0, -1) : zoneId);
/** The tile an NPC is standing on, wherever in the building they are. */
const standingOn = (zone, npc) => zone.object[zone.w * Math.round(npc.y) + Math.round(npc.x)];

function checkWorld(w, sealed, label) {
  assert.equal(w.startZone, "z1", `${label}: settlement is z1`);
  assert.ok(w.zones.z1, `${label}: z1 exists`);
  // Every named zone in the brief exists under its ordinal id — except an
  // INTERIOR place the settlement had no lot to stand on, which is dropped
  // rather than sealed (20-world's facade guard; a named room with no door in
  // either direction strands whoever is homed there). A wilds hangs off a map
  // edge and needs no lot, so it is never allowed to go missing.
  for (const [id, name] of Object.entries(sealed._ids.zones)) {
    if (!w.zones[id]) {
      const place = sealed.places[Number(id.slice(1)) - 2];
      assert.ok(place && place.kind !== "wilds", `${label}: zone ${id} (${name}) compiled`);
      continue;
    }
    assert.equal(w.zones[id].name, name, `${label}: ${id} keeps its display name`);
  }
  // Every cast member is placed in a real zone, with a legal wander rect.
  const placed = Object.values(w.zones).flatMap((z) => z.npcs.map((n) => n.name));
  for (const member of sealed.cast) assert.ok(placed.includes(member.name), `${label}: ${member.name} placed`);
  for (const zone of Object.values(w.zones)) {
    for (const npc of zone.npcs) {
      assert.ok(npc.wander.x0 >= 0 && npc.wander.x1 < zone.w && npc.wander.y0 >= 0 && npc.wander.y1 < zone.h,
        `${label}: ${npc.name} wander inside ${zone.id}`);
      // Never spawned ON a solid tile — a scattered wilds trunk on the zone
      // center used to swallow the NPC anchored there (stepNpcs vets only the
      // tiles it moves TO, so the overlap persists until a lucky step). Bounds
      // first: an out-of-zone index reads undefined from the Uint8Array, and
      // a negated undefined would wave the invalid spawn through (review
      // finding); walkable is exactly 0 — put() only ever writes 0 or 1.
      assert.ok(
        Number.isInteger(npc.x) && npc.x >= 0 && npc.x < zone.w && Number.isInteger(npc.y) && npc.y >= 0 && npc.y < zone.h,
        `${label}: ${npc.name} spawn inside ${zone.id}`,
      );
      assert.equal(zone.solid[zone.w * npc.y + npc.x], 0, `${label}: ${npc.name} spawns walkable in ${zone.id}`);
    }
    // Portals land on walkable tiles in their destination — and the portal's
    // OWN tile must be walkable too, or the player can never step onto it.
    for (const portal of zone.portals) {
      const dest = w.zones[portal.toZone];
      assert.ok(dest, `${label}: portal target ${portal.toZone} exists`);
      assert.ok(!dest.solid[dest.w * portal.toY + portal.toX], `${label}: portal to ${portal.toZone} lands walkable`);
      assert.ok(!zone.solid[zone.w * portal.y + portal.x], `${label}: portal source in ${zone.id} is reachable`);
    }
  }
  // Housing honors the arithmetic (§4.5): every resident the settlement is
  // RESPONSIBLE for has a sleeping place of their own — their household's
  // dwelling, or the live-work premises their family runs.
  //
  // Counted in the SCHEDULE HANDLES, not in doors. A door used to mean a roof
  // and it no longer does: a merged block is one door for several households,
  // and a smithy is a door that is also a home, so a door count can be smaller
  // than the household count and still house everyone. The handles are also the
  // thing that actually has to be right — a bed nobody is sent to is scenery.
  //
  // Every non-resident lives by their standing and is not the settlement's to
  // house; which RESIDENTS it owes a roof is spelled out below the sweep.
  const v = w.zones.z1;
  const bedded = new Map(); // npc id -> the sleeping tile its `home` handle names
  for (const zone of Object.values(w.zones)) {
    for (const npc of zone.npcs) {
      const handle = npc._sched?.home;
      const target = handle && w.zones[handle.zoneId];
      if (!target) continue;
      const { x0, y0 } = handle.wander;
      if (SLEEPS_ON.has(target.object[target.w * y0 + x0])) bedded.set(npc.id, `${handle.zoneId}:${x0},${y0}`);
    }
  }
  // Who the settlement owes a bed: every RESIDENT who lives in one of its
  // BUILDINGS — at the root (a dwelling, or the family trade they live over) and
  // equally one the brief homed at a named place, because `home` naming a place
  // is how a brief says "this person lives here". Scoping this to root-homed
  // residents is what let a chaplain sleep on the floor of her own church.
  //
  // A resident whose named home never claimed a lot is NOT exempt: the building
  // they live in does not exist in this world, so they live in the settlement
  // like anybody else and the town owes them a roof. The one exemption left is a
  // resident homed at a WILDS — they live outdoors and sleep rough, which is what
  // living in the woods is.
  const zoneIdForName = new Map(Object.entries(sealed._ids.zones).map(([id, zoneName]) => [zoneName, id]));
  sealed.cast.forEach((member, index) => {
    if ((member.standing ?? "resident") !== "resident") return;
    if (w.zones[zoneIdForName.get(member.home) ?? "z1"]?.mapKind === "place") return;
    assert.ok(bedded.has(`n${index + 1}`), `${label}: ${member.name} has a sleeping place of their own`);
  });
  // Never the same berth twice: two sprites on one tile makes the lower one
  // un-talkable, which is the whole reason a bed is one tile per sleeper.
  const berths = [...bedded.values()];
  assert.equal(new Set(berths).size, berths.length, `${label}: no berth is dealt to two sleepers`);
  assert.ok(!v.solid[v.w * v.spawn.y + v.spawn.x], `${label}: spawn walkable`);
}

// 10. Both themed default briefs compile with all invariants holding.
for (const theme of ["cozy-village", "sci-fi-colony"]) {
  const sealed = brief.defaults(theme, 424242);
  checkWorld(world.build(424242, theme, sealed), sealed, `defaults(${theme})`);
}

// 11. The farm-village case compiles: four households → four-ish roofs, never thirty.
{
  const sealed = brief.validate(
    {
      scale: "village", name: "Mossbrook", backgroundPopulation: 30,
      places: [{ kind: "hall", name: "The Grange Hall" }, { kind: "gathering", name: "The Wet Boot" }],
      cast: [
        { name: "Alder", role: "mayor", kind: "leader", tint: "blue", home: "Mossbrook", household: 1 },
        { name: "Nessa", role: "daughter", kind: "folk", tint: "violet", home: "Mossbrook", household: 1 },
        { name: "Perrin", role: "innkeep", kind: "host", tint: "amber", home: "The Wet Boot", household: 2 },
        { name: "Sera", role: "weaver", kind: "elder", tint: "rose", home: "Mossbrook", household: 3 },
        { name: "Brint", role: "farmhand", kind: "grower", tint: "green", home: "Mossbrook", household: 4 },
        { name: "Marla", role: "farmhand", kind: "grower", tint: "teal", home: "Mossbrook", household: 4 },
      ],
    },
    ctx,
  );
  const w = world.build(424242, "cozy-village", sealed);
  checkWorld(w, sealed, "mossbrook");
  const v = w.zones.z1;
  const doorCount = v.object.filter((t) => t === "door").length;
  assert.ok(doorCount >= 4 && doorCount <= 10, `a handful of doors (${doorCount}), never thirty`);
  assert.ok(w.zones.z2 && w.zones.z3, "hall and gathering interiors compiled");
  // The only fixture that proves home-to-zone binding for a NON-root home:
  // resolve the gathering's ordinal id and assert membership in THAT zone.
  const gatheringId = Object.entries(sealed._ids.zones).find(([, zoneName]) => zoneName === "The Wet Boot")?.[0];
  assert.ok(gatheringId, "the gathering has an ordinal id");
  const innkeeper = w.zones[gatheringId].npcs.find((n) => n.name === "Perrin");
  assert.ok(innkeeper, "the innkeeper lives in the gathering interior");
}

// 11b. Standing: non-residents get no dwelling and anchor to a rest spot —
// transient → a public loiter spot, fringe → the wilds, destitute → the plaza.
{
  const sealed = brief.validate(
    {
      scale: "village", name: "Crossford",
      places: [{ kind: "gathering", name: "The Ford Inn" }, { kind: "wilds", name: "The Reach" }],
      cast: [
        { name: "Alder", role: "reeve", kind: "leader", tint: "blue", home: "Crossford", household: 1 },
        { name: "Bram", role: "smith", kind: "maker", tint: "amber", home: "Crossford", household: 2 },
        { name: "Sil", role: "wayfarer", kind: "wanderer", tint: "green", home: "Crossford", household: 3, standing: "transient" },
        { name: "Wyn", role: "hermit", kind: "wanderer", tint: "teal", home: "Crossford", household: 4, standing: "fringe" },
        { name: "Gad", role: "beggar", kind: "folk", tint: "rose", home: "Crossford", household: 5, standing: "destitute" },
        { name: "Rue", role: "weaver", kind: "elder", tint: "violet", home: "Crossford", household: 2, standing: "nonsense" },
      ],
    },
    ctx,
  );
  // Fold: omitted → resident, unknown → resident, valid values preserved.
  const by = (name) => sealed.cast.find((c) => c.name === name);
  assert.equal(by("Alder").standing, "resident", "omitted standing defaults to resident");
  assert.equal(by("Rue").standing, "resident", "unknown standing folds to resident");
  assert.equal(by("Sil").standing, "transient", "valid standing preserved");
  assert.equal(by("Wyn").standing, "fringe", "valid standing preserved");
  assert.equal(by("Gad").standing, "destitute", "valid standing preserved");

  const w = world.build(424242, "cozy-village", sealed);
  checkWorld(w, sealed, "standing");
  const v = w.zones.z1;
  const innId = Object.entries(sealed._ids.zones).find(([, n]) => n === "The Ford Inn")?.[0];
  const woodsId = Object.entries(sealed._ids.zones).find(([, n]) => n === "The Reach")?.[0];
  assert.ok(innId && woodsId, "the inn and the wilds have ordinal ids");
  assert.ok(w.zones[woodsId].npcs.some((n) => n.name === "Wyn"), "fringe retreats to the wilds");
  const gad = v.npcs.find((n) => n.name === "Gad");
  assert.ok(gad, "destitute stays in the settlement");
  const mX = (v.w / 2) | 0;
  const mY = (v.h / 2) | 0;
  assert.deepEqual(
    gad.wander,
    { x0: mX - 6, y0: mY - 5, x1: mX + 6, y1: mY + 5 },
    "destitute anchors to the public center, never a house",
  );
  assert.ok(!v.npcs.some((n) => n.name === "Wyn"), "the fringe NPC leaves the settlement for the wilds");

  // Walkable-spawn regression: seed 6 scatters a trunk exactly on the wilds
  // center tile (17,11), where the fringe hermit anchors — before the spawn
  // nudge Wyn spawned INSIDE it (checkWorld's walkable-spawn assert catches
  // the overlap; ~7% of seeds reproduced it on this fixture).
  checkWorld(world.build(6, "cozy-village", sealed), sealed, "standing-solid-center");
}

// 11c. Standing SUPPRESSION + the no-inn / no-wilds fallbacks. A non-resident
// holding a special-kind that no resident claims builds nothing; non-resident
// households add no roof (exact door count catches a deleted gate); and with no
// gathering/wilds present, transient falls back to the plaza and fringe to the
// settlement's outer margin.
{
  const sealed = brief.validate(
    {
      scale: "village",
      name: "Wayrest",
      places: [{ kind: "hall", name: "The Moot Hall" }],
      cast: [
        { name: "Ada", role: "elder", kind: "folk", tint: "blue", home: "Wayrest", household: 1 },
        { name: "Ben", role: "cooper", kind: "folk", tint: "amber", home: "Wayrest", household: 2 },
        { name: "Cal", role: "digger", kind: "folk", tint: "green", home: "Wayrest", household: 3 },
        { name: "Dov", role: "sellsword", kind: "guard", tint: "red", home: "Wayrest", household: 4, standing: "transient" },
        { name: "Esk", role: "hermit", kind: "wanderer", tint: "teal", home: "Wayrest", household: 5, standing: "fringe" },
        { name: "Fyn", role: "beggar", kind: "folk", tint: "rose", home: "Wayrest", household: 6, standing: "destitute" },
      ],
    },
    ctx,
  );
  const w = world.build(4242, "cozy-village", sealed);
  checkWorld(w, sealed, "standing-suppression");
  const v = w.zones.z1;
  // 3 resident dwellings + 1 hall facade = 4 doors. The transient guard's
  // "post" is suppressed and no non-resident household adds a dwelling; deleting
  // either the specials gate or the households filter would raise this count.
  const doorCount = v.object.filter((t) => t === "door").length;
  assert.equal(doorCount, 4, `only residents build (got ${doorCount} doors, expected 4)`);
  assert.equal(v.object.filter((t) => t === "table").length, 0, "a transient non-merchant lays no stall");
  assert.ok(!Object.values(w.zones).some((z) => z.mapKind === "place"), "no wilds synthesized (places is non-empty)");
  const mX = (v.w / 2) | 0;
  const mY = (v.h / 2) | 0;
  const plaza = { x0: mX - 6, y0: mY - 5, x1: mX + 6, y1: mY + 5 };
  const wander = (name) => v.npcs.find((n) => n.name === name).wander;
  assert.deepEqual(wander("Dov"), plaza, "transient with no inn falls back to the plaza");
  assert.deepEqual(
    wander("Esk"),
    { x0: 3, y0: v.h - 6, x1: v.w - 4, y1: v.h - 3 },
    "fringe with no wilds falls back to the outer margin",
  );
  assert.deepEqual(wander("Fyn"), plaza, "destitute anchors to the public center");
}

// 11d. Transient merchants set up a light market stall (a 3-table structure,
// never a permanent shop) and tend it. A transient non-merchant, or a merchant
// with no free lot, does not.
{
  const sealed = brief.validate(
    {
      scale: "village",
      name: "Fairmarket",
      cast: [
        { name: "Ona", role: "elder", kind: "folk", tint: "blue", home: "Fairmarket", household: 1 },
        { name: "Pel", role: "cooper", kind: "folk", tint: "green", home: "Fairmarket", household: 2 },
        { name: "Rin", role: "weaver", kind: "folk", tint: "amber", home: "Fairmarket", household: 3 },
        { name: "Sol", role: "spice trader", kind: "merchant", tint: "rose", home: "Fairmarket", household: 4, standing: "transient" },
      ],
    },
    ctx,
  );
  const w = world.build(4242, "cozy-village", sealed);
  checkWorld(w, sealed, "merchant-stall");
  const v = w.zones.z1;
  // One transient merchant -> exactly one 3-table stall in the settlement.
  const tables = v.object.filter((t) => t === "table").length;
  assert.equal(tables, 3, `the transient merchant set up a 3-table stall (got ${tables})`);
  const sol = v.npcs.find((n) => n.name === "Sol");
  assert.ok(sol, "the transient merchant tends the stall in the settlement");
  // Tending it: the tile directly above the merchant's counter is a stall table.
  assert.equal(v.object[v.w * (sol.y - 1) + sol.x], "table", "the merchant stands at their stall counter");
}

// 11e. Transients loiter at PUBLIC spots and spread across them. With an inn, a
// resident shop, and three transients (three spots), the seeded round-robin puts
// one inside the inn, one at the shop front, and one in the plaza.
{
  const sealed = brief.validate(
    {
      scale: "village",
      name: "Tradeholm",
      places: [{ kind: "gathering", name: "The Rest" }],
      cast: [
        { name: "Ada", role: "elder", kind: "folk", tint: "blue", home: "Tradeholm", household: 1 },
        { name: "Ben", role: "farmer", kind: "folk", tint: "green", home: "Tradeholm", household: 2 },
        { name: "Cor", role: "shopkeep", kind: "merchant", tint: "amber", home: "Tradeholm", household: 3 },
        { name: "Vye", role: "pilgrim", kind: "scholar", tint: "teal", home: "Tradeholm", household: 4, standing: "transient" },
        { name: "Wil", role: "drifter", kind: "wanderer", tint: "rose", home: "Tradeholm", household: 5, standing: "transient" },
        { name: "Xio", role: "envoy", kind: "elder", tint: "violet", home: "Tradeholm", household: 6, standing: "transient" },
      ],
    },
    ctx,
  );
  const w = world.build(99, "cozy-village", sealed);
  checkWorld(w, sealed, "loiter-spread");
  const v = w.zones.z1;
  const innId = Object.entries(sealed._ids.zones).find(([, n]) => n === "The Rest")?.[0];
  const mX = (v.w / 2) | 0;
  const mY = (v.h / 2) | 0;
  const plaza = JSON.stringify({ x0: mX - 6, y0: mY - 5, x1: mX + 6, y1: mY + 5 });
  const names = ["Vye", "Wil", "Xio"];
  const inInn = names.filter((n) => w.zones[innId].npcs.some((x) => x.name === n));
  assert.equal(inInn.length, 1, "one transient loiters inside the inn");
  const inV = names.filter((n) => v.npcs.some((x) => x.name === n)).map((n) => v.npcs.find((x) => x.name === n));
  assert.equal(inV.length, 2, "the other two loiter out in the settlement");
  assert.equal(inV.filter((t) => JSON.stringify(t.wander) === plaza).length, 1, "one loiters in the plaza");
  const atShop = inV.filter((t) => JSON.stringify(t.wander) !== plaza);
  assert.equal(atShop.length, 1, "one loiters at the shop front");
  const s = atShop[0];
  // Beside the door, not in it: the shop door sits up-and-left of the loiter box.
  assert.equal(
    v.object[v.w * (s.wander.y0 - 1) + (s.wander.x0 - 1)],
    "door",
    "the shop-loiterer stands beside a shop door, not in the doorway",
  );
}

// 11f. A transient merchant with NO free lot lays no stall and still loiters at
// a public spot (here the residents' buildings consume every lot: a hall, a
// duty-station post, the farmer's live-work farm and three dwellings — six lots,
// which is every lot a village's rows fit).
{
  const sealed = brief.validate(
    {
      scale: "village",
      name: "Fullford",
      cast: [
        { name: "Ona", role: "reeve", kind: "leader", tint: "blue", home: "Fullford", household: 1 },
        { name: "Pel", role: "farmer", kind: "grower", tint: "green", home: "Fullford", household: 2 },
        { name: "Gar", role: "watch", kind: "guard", tint: "red", home: "Fullford", household: 3 },
        { name: "Tam", role: "cooper", kind: "folk", tint: "amber", home: "Fullford", household: 5 },
        { name: "Sol", role: "peddler", kind: "merchant", tint: "rose", home: "Fullford", household: 4, standing: "transient" },
      ],
    },
    ctx,
  );
  const w = world.build(4242, "cozy-village", sealed);
  checkWorld(w, sealed, "stall-no-lot");
  const v = w.zones.z1;
  assert.equal(v.object.filter((t) => t === "table").length, 0, "no free lot -> the transient merchant lays no stall");
  const sol = v.npcs.find((n) => n.name === "Sol");
  assert.ok(sol, "the merchant still loiters at a public spot");
  const mX = (v.w / 2) | 0;
  const mY = (v.h / 2) | 0;
  assert.deepEqual(sol.wander, { x0: mX - 6, y0: mY - 5, x1: mX + 6, y1: mY + 5 }, "falls back to the plaza");
}

// 11g. A shop with an interior (a workshop) — a loitering transient browses
// INSIDE it (the mechanism the inn already uses); facade shops keep them outside.
{
  const sealed = brief.validate(
    {
      scale: "village",
      name: "Forgeton",
      places: [{ kind: "workshop", name: "The Forge" }],
      cast: [
        { name: "Ada", role: "elder", kind: "folk", tint: "blue", home: "Forgeton", household: 1 },
        { name: "Ben", role: "cooper", kind: "folk", tint: "green", home: "Forgeton", household: 2 },
        { name: "Cor", role: "smith", kind: "maker", tint: "amber", home: "The Forge", household: 3 },
        { name: "Vye", role: "pilgrim", kind: "scholar", tint: "teal", home: "Forgeton", household: 4, standing: "transient" },
        { name: "Wil", role: "drifter", kind: "wanderer", tint: "rose", home: "Forgeton", household: 5, standing: "transient" },
      ],
    },
    ctx,
  );
  const w = world.build(99, "cozy-village", sealed);
  checkWorld(w, sealed, "shop-interior");
  const forgeId = Object.entries(sealed._ids.zones).find(([, n]) => n === "The Forge")?.[0];
  assert.ok(forgeId, "the workshop shop has an ordinal id");
  const inForge = ["Vye", "Wil"].filter((n) => w.zones[forgeId].npcs.some((x) => x.name === n));
  assert.equal(inForge.length, 1, "one transient browses inside the workshop shop; the other loiters elsewhere");
}

// 11h. The dwelling gate is home-aware: a resident who lives at the root gets a town
// house, but a resident whose home is the wilds (a forager who lives in the woods)
// sleeps THERE and mints NO phantom settlement dwelling. With an all-folk cast (no
// special buildings) at/above castMin (no stock top-up) and only a wilds place (no
// interior facades), every z1 door is a dwelling — so the door count equals the
// DISTINCT ROOT-resident households exactly; the wilds resident adds none. (checkWorld
// only asserts >=; this pins the equality that a gate regression would break.)
{
  const sealed = brief.validate(
    {
      scale: "village",
      name: "Wold",
      places: [{ kind: "wilds", name: "The Fen" }],
      cast: [
        { name: "Ana", role: "reeve", kind: "folk", tint: "blue", home: "Wold", household: 1 },
        { name: "Bo", role: "cooper", kind: "folk", tint: "green", home: "Wold", household: 2 },
        { name: "Cy", role: "weaver", kind: "folk", tint: "amber", home: "Wold", household: 3 },
        { name: "Del", role: "carter", kind: "folk", tint: "rose", home: "Wold", household: 4 },
        { name: "Fenn", role: "forager", kind: "folk", tint: "teal", home: "The Fen", household: 5 },
      ],
    },
    ctx,
  );
  const w = world.build(7, "cozy-village", sealed);
  checkWorld(w, sealed, "dwelling-gate");
  const v = w.zones.z1;
  const rootName = sealed._ids.zones.z1;
  const rootHouseholds = new Set(
    sealed.cast.filter((c) => c.home === rootName && (c.standing ?? "resident") === "resident").map((c) => c.household),
  );
  const doorCount = v.object.filter((t) => t === "door").length;
  assert.equal(
    doorCount,
    rootHouseholds.size,
    `a door per root household, none for the wilds resident (${doorCount} doors vs ${rootHouseholds.size} root households)`,
  );
  const fenId = Object.entries(sealed._ids.zones).find(([, n]) => n === "The Fen")[0];
  assert.ok(
    w.zones[fenId].npcs.some((n) => n.name === "Fenn"),
    "the wilds resident lives (and sleeps) out in the wilds zone, not in an empty town house",
  );
}

// 11i. Scattered trees never land under a building's roof overhang — the overhang
// rows are grass and non-solid, so only an explicit overhead-layer guard keeps a
// trunk from being drawn under (and visually eaten by) a roof. Swept across seeds.
{
  for (let seed = 1; seed <= 60; seed++) {
    const sealed = brief.validate(
      {
        scale: "village",
        name: "Timbrel",
        surround: "woods",
        cast: [
          { name: "Ada", role: "reeve", kind: "leader", tint: "blue", home: "Timbrel", household: 1 },
          { name: "Ben", role: "smith", kind: "maker", tint: "green", home: "Timbrel", household: 2 },
          { name: "Ces", role: "farmer", kind: "grower", tint: "amber", home: "Timbrel", household: 3 },
          { name: "Dan", role: "carter", kind: "folk", tint: "rose", home: "Timbrel", household: 4 },
        ],
      },
      ctx,
    );
    const v = world.build(seed, "cozy-village", sealed).zones.z1;
    // Guard against a trivially-passing check: the world must actually have roofs.
    assert.ok(v.overhead.some((t) => t === "roof" || t === "roofEdge"), `seed ${seed}: has roofs to test against`);
    for (let i = 0; i < v.object.length; i++) {
      if (v.object[i] !== "trunk") continue;
      const oh = v.overhead[i];
      assert.ok(oh !== "roof" && oh !== "roofEdge", `seed ${seed}: no trunk under a roof (tile ${i} overhead ${oh})`);
    }
  }
}

// 11j. The stall pass handles MORE than one transient merchant: given free lots for
// both, each lays its own 3-table stall and tends it — the loop does not stop at one.
{
  const sealed = brief.validate(
    {
      scale: "town",
      name: "Twomarket",
      cast: [
        { name: "Ona", role: "elder", kind: "folk", tint: "blue", home: "Twomarket", household: 1 },
        { name: "Sol", role: "spice trader", kind: "merchant", tint: "rose", home: "Twomarket", household: 2, standing: "transient" },
        { name: "Tam", role: "silk trader", kind: "merchant", tint: "teal", home: "Twomarket", household: 3, standing: "transient" },
      ],
    },
    ctx,
  );
  const w = world.build(4242, "cozy-village", sealed);
  checkWorld(w, sealed, "two-merchants");
  const v = w.zones.z1;
  assert.equal(v.object.filter((t) => t === "table").length, 6, "two transient merchants -> two 3-table stalls");
  for (const name of ["Sol", "Tam"]) {
    const m = v.npcs.find((n) => n.name === name);
    assert.ok(m, `${name} is placed`);
    assert.equal(v.object[v.w * (m.y - 1) + m.x], "table", `${name} stands at their own stall counter`);
  }
}

// 12. Determinism: same brief + seed → structurally identical world.
{
  const sealed = brief.defaults("cozy-village", 7);
  const a = world.build(7, "cozy-village", sealed);
  const b = world.build(7, "cozy-village", sealed);
  assert.equal(JSON.stringify(a.zones.z1.ground), JSON.stringify(b.zones.z1.ground), "compile is deterministic");
}

// 13. Legacy path untouched: no brief → the fixed three-zone world.
{
  const w = world.build(424242, "cozy-village");
  assert.deepEqual(Object.keys(w.zones).sort(), ["forest", "inn", "village"], "legacy zones for pre-brief saves");
}

// 14. §7 injection discipline: prose rides the world; the prefix meters it once.
{
  const sealed = brief.validate(
    {
      scale: "village", name: "Meterton",
      flavor: "Dust and patience.",
      situation: "Foreman Vex is hiding the cracked dome report from surveyor Yun.",
      places: [{ kind: "gathering", name: "The Bar", flavor: "Low lights, long tabs." }],
      cast: [
        { name: "Vex", role: "foreman", kind: "leader", tint: "red", home: "Meterton", household: 1, persona: "Wants quota; hiding the report." },
        { name: "Yun", role: "surveyor", kind: "scholar", tint: "teal", home: "Meterton", household: 2, persona: "Wants truth; hiding the source." },
        { name: "Bel", role: "barkeep", kind: "host", tint: "amber", home: "The Bar", household: 3, persona: "" },
        { name: "Six", role: "runner", kind: "wanderer", tint: "violet", home: "Meterton", household: 4, persona: "" },
      ],
    },
    ctx,
  );
  const w = world.build(424242, "sci-fi-colony", sealed);
  assert.equal(w.situation, sealed.situation, "situation rides the world");
  assert.equal(w.zones.z2.flavor, "Low lights, long tabs.", "zone flavor rides the zone");
  // A minimal sim stub exercising composePrefix without the full Sim class.
  const sim = {
    world: w, zoneId: "z1", nearNpc: null, dirty: false,
    zone() { return this.world.zones[this.zoneId]; },
    clockLabel: () => "Day 1 · 08:00",
    daypart: () => "day",
  };
  // Borrow the real methods off the shipped Sim prototype.
  sim.header = loadedPF.Sim.prototype.header.bind(sim);
  sim.composePrefix = loadedPF.Sim.prototype.composePrefix.bind(sim);
  sim.commitIntro = loadedPF.Sim.prototype.commitIntro.bind(sim);
  const npcVex = Object.values(w.zones).flatMap((z) => z.npcs).find((n) => n.name === "Vex");
  const first = sim.composePrefix(npcVex);
  assert.ok(first.includes("[Setting: Foreman Vex is hiding"), "situation injected on the first message");
  assert.ok(first.includes("[Vex: Wants quota"), "persona injected on first talk");
  // Compose is PURE: a refused/failed send must not burn the prose (review
  // finding) — only commitIntro(), called when the host accepts, does.
  assert.equal(sim.dirty, false, "compose alone never dirties the save");
  const retry = sim.composePrefix(npcVex);
  assert.ok(retry.includes("[Setting:") && retry.includes("Wants quota"), "uncommitted prose survives for a retry");
  sim.commitIntro();
  assert.ok(sim.dirty, "the accepted turn burns the flags and dirties the save");
  const second = sim.composePrefix(npcVex);
  assert.ok(!second.includes("[Setting:"), "situation never re-injected");
  assert.ok(!second.includes("Wants quota"), "persona never re-injected for the same NPC");
  sim.commitIntro(); // a prose-free prefix commits as a no-op
  sim.zoneId = "z2";
  const barEntry = sim.composePrefix(null);
  assert.ok(barEntry.includes("[The Bar: Low lights"), "zone flavor injected once on first entry");
  sim.commitIntro();
  assert.ok(!sim.composePrefix(null).includes("Low lights"), "zone flavor not repeated");
}

// 15. salvageText: fences, chatter, string-aware spans, truncated tails.
{
  const fenced = brief.salvageText('```json\n{"scale":"village","name":"Salv"}\n```');
  assert.equal(fenced?.name, "Salv", "fences stripped, object parsed");
  const wrapped = brief.salvageText('Sure! Here is the world: {"name":"Wrap","cast":[]} Hope you like it.');
  assert.equal(wrapped?.name, "Wrap", "outermost balanced span extracted from chatter");
  const braces = brief.salvageText('{"name":"Brace {not a block}","cast":[]}');
  assert.equal(braces?.name, "Brace {not a block}", "braces inside strings don't derail the scanner");
  const truncated = brief.salvageText('{"name":"Cut","cast":[{"name":"A","kind":"folk"},{"name":"B","ki');
  assert.equal(truncated?.name, "Cut", "truncated document closed and parsed");
  assert.deepEqual(truncated.cast[0], { name: "A", kind: "folk" }, "complete array elements survive the cut");
  assert.ok(truncated.cast.every((c) => !("ki" in c)), "the partial trailing field is dropped");
  assert.equal(brief.salvageText("no json here"), null, "no object → null");
  assert.equal(brief.salvageText(""), null, "empty → null");
}

// 16. Leader hoist: a leader past the cast cap is kept, not silently dropped.
{
  const rawCast = [];
  for (let i = 0; i < 11; i++) {
    rawCast.push({ name: `Villager ${i}`, kind: "folk", tint: "green", home: "Hoistton", household: (i % 6) + 1 });
  }
  rawCast.push({ name: "Mayor Last", kind: "leader", tint: "blue", home: "Hoistton", household: 1 });
  const sealed = brief.validate({ scale: "village", name: "Hoistton", cast: rawCast }, ctx);
  assert.ok(sealed.cast.length <= brief.CAPS.castMax, "cast capped");
  assert.ok(sealed.cast.some((c) => c.name === "Mayor Last" && c.kind === "leader"), "the leader is hoisted into the kept set");
}

// 17. Host synthesis: a host with no gathering place gets an interior to keep.
{
  const sealed = brief.validate(
    {
      scale: "village", name: "Hostville",
      places: [{ kind: "wilds", name: "The Briar" }],
      cast: [
        { name: "Perrin", kind: "host", tint: "amber", home: "Hostville", household: 1 },
        { name: "A", kind: "folk", tint: "green", home: "Hostville", household: 2 },
        { name: "B", kind: "folk", tint: "blue", home: "Hostville", household: 3 },
        { name: "C", kind: "folk", tint: "rose", home: "Hostville", household: 4 },
      ],
    },
    ctx,
  );
  const gathering = sealed.places.find((p) => p.kind === "gathering");
  assert.ok(gathering, "a gathering interior is synthesized for the host");
  assert.ok(gathering.name.includes("Perrin"), "the synthesized place is named from the host");
}

// 18. Name dedupe holds even when the same name floods several place kinds.
{
  const sealed = brief.validate(
    {
      scale: "village", name: "Sameton",
      places: [
        { kind: "gathering", name: "The Same" },
        { kind: "hall", name: "The Same" },
        { kind: "wilds", name: "The Same" },
        { kind: "wilds", name: "the same" },
      ],
      cast: [
        { name: "A", kind: "folk", tint: "green", home: "Sameton", household: 1 },
        { name: "B", kind: "folk", tint: "blue", home: "Sameton", household: 2 },
        { name: "C", kind: "folk", tint: "rose", home: "Sameton", household: 3 },
        { name: "D", kind: "folk", tint: "teal", home: "Sameton", household: 4 },
      ],
    },
    ctx,
  );
  const folded = sealed.places.map((p) => p.name.toLowerCase());
  assert.equal(new Set(folded).size, folded.length, "every collision resolved to a unique name");
  assert.ok(!folded.includes(sealed.name.toLowerCase()), "no place shadows the settlement itself");
}

// 19. A situation with no sentence boundary inside the cap degrades to EMPTY —
// a cut hook is worse than none (§4.2).
{
  const endless = `The foreman is hiding ${"a very long secret about the dome and the survey and the quota ".repeat(6)}forever`;
  const sealed = brief.validate({ scale: "village", name: "Runon", situation: endless, cast: [] }, ctx);
  assert.equal(sealed.situation, "", "clause-losing truncation degrades to empty");
}

// 20. Two wilds: both compile, both are reachable from the settlement and lead
// back (the west-hung wilds mirrors the approach road — review finding).
{
  const sealed = brief.validate(
    {
      scale: "village", name: "Twinwood",
      places: [
        { kind: "wilds", name: "East Reach" },
        { kind: "wilds", name: "West Reach" },
        { kind: "gathering", name: "The Hearth" },
      ],
      cast: [
        { name: "A", kind: "host", tint: "amber", home: "The Hearth", household: 1 },
        { name: "B", kind: "folk", tint: "green", home: "Twinwood", household: 2 },
        { name: "C", kind: "folk", tint: "blue", home: "Twinwood", household: 3 },
        { name: "D", kind: "folk", tint: "rose", home: "Twinwood", household: 4 },
      ],
    },
    ctx,
  );
  const w = world.build(424242, "cozy-village", sealed);
  checkWorld(w, sealed, "twinwood");
  const wildsIds = Object.values(w.zones).filter((z) => sealed.places.some((p, i) => p.kind === "wilds" && `z${i + 2}` === z.id)).map((z) => z.id);
  assert.equal(wildsIds.length, 2, "both wilds compiled");
  for (const id of wildsIds) {
    assert.ok(w.zones.z1.portals.some((p) => p.toZone === id), `settlement has a portal to ${id}`);
    assert.ok(w.zones[id].portals.some((p) => p.toZone === "z1"), `${id} leads back to the settlement`);
  }
}

// 21. Review blocker regression: the spatial seed binding uses the world's OWN
// start zone (compiled worlds key z1..), and a stale binding degrades safely.
{
  const sealed = brief.defaults("cozy-village", 99);
  const w = world.build(99, "cozy-village", sealed);
  const sim = {
    world: w, zoneId: w.startZone, mode: "walk",
    zone() { return this.world.zones[this.zoneId]; },
    teleport(zoneId) { this.zoneId = zoneId; },
  };
  let dirtied = false;
  const core = { chatId: "chat-spatial", sim, markDirty: () => { dirtied = true; }, hud: { toast() {}, refreshChips() {} } };
  loadedPF.api = loadedPF.api ?? {};
  const prevGetSpatial = loadedPF.api.getSpatial;
  loadedPF.api.getSpatial = async () => ({
    definition: { revision: 1 }, currentLocationId: "loc-root",
    breadcrumb: [{ name: "Rootville" }], destinations: [],
  });
  loadedPF.spatial.reset();
  await loadedPF.spatial.refresh(core);
  assert.equal(w.bindings["loc-root"], "z1", "first-seen location binds the compiled start zone, never a legacy literal");
  assert.equal(w.zones.z1.spatialLocationId, "loc-root", "the zone records its location id");
  assert.ok(dirtied, "the seeded binding persists via a save");
  // Narrated drift onto a STALE binding (zone gone) must not throw or teleport.
  w.bindings["loc-ghost"] = "no-such-zone";
  loadedPF.api.getSpatial = async () => ({
    definition: { revision: 1 }, currentLocationId: "loc-ghost",
    breadcrumb: [{ name: "Ghost" }], destinations: [],
  });
  await loadedPF.spatial.refresh(core);
  assert.equal(sim.zoneId, "z1", "a stale binding degrades to staying put");
  // Leave no stub behind: later cases must not inherit this case's spatial state.
  loadedPF.api.getSpatial = prevGetSpatial;
  loadedPF.spatial.reset();
}

// 22-25. The §5 failure ladder (amended): transients leave the chat UNSEALED,
// truncation re-rolls plainly and salvages the longest raw across attempts,
// and only deterministic/paid failures seal the themed default.
{
  loadedPF.api = loadedPF.api ?? {};
  const prevPost = loadedPF.api.postExperienceGeneration;
  const calls = [];
  const stub = (script) => {
    let i = 0;
    loadedPF.api.postExperienceGeneration = async (chatId, body) => {
      calls.push(body);
      return script[Math.min(i++, script.length - 1)];
    };
  };

  // 22. Route absent (old engine) → null: unsealed, the next visit retries.
  calls.length = 0;
  stub([{ status: 404, body: null }]);
  assert.equal(await brief.generate("c", { theme: "cozy-village", seed: 1, preferences: "" }), null, "404 → unsealed");

  // 23. Truncated twice → plain re-roll (NO maxTokens override — the route
  // treats it as min()-only) + longest-raw salvage across both attempts.
  calls.length = 0;
  const longRaw =
    '{"scale":"village","name":"Longton","cast":[{"name":"A","kind":"folk","tint":"red","home":"Longton","household":1},{"name":"B","ki';
  const shortRaw = '{"scale":"village","name":"Shor';
  stub([
    { status: 422, body: { truncated: true, raw: longRaw } },
    { status: 422, body: { truncated: true, raw: shortRaw } },
  ]);
  const salvagedSeal = await brief.generate("c", { theme: "cozy-village", seed: 1, preferences: "p" });
  assert.equal(calls.length, 2, "exactly one re-roll");
  assert.ok(!("maxTokens" in calls[1]), "the re-roll carries no maxTokens override");
  assert.equal(salvagedSeal.name, "Longton", "the LONGEST raw wins the salvage even when the retry's is shorter");
  assert.ok(salvagedSeal._repairs.some((r) => r.includes("salvaged")), "salvage recorded in _repairs");

  // 24. Deterministic provider failure → sealed themed default (a paid call
  // per visit would be worse than the default world).
  stub([{ status: 422, body: { code: "provider_error", truncated: false } }]);
  const sealedDefault = await brief.generate("c", { theme: "sci-fi-colony", seed: 2, preferences: "" });
  assert.ok(sealedDefault && Array.isArray(sealedDefault.cast), "provider_error seals a full brief");
  assert.equal(sealedDefault.theme, "sci-fi-colony", "the sealed default keeps the theme");

  // 25. 409 chat_busy waits out Retry-After once inside the budget, then
  // succeeds; oversized preferences clamp under the route's 8,000-char cap.
  // busyWaitMs: 0 is the timer seam — the harness never sleeps for real.
  calls.length = 0;
  stub([
    { status: 409, body: { code: "chat_busy" } },
    { status: 200, body: { ok: true, data: { scale: "hamlet", name: "Busyville", cast: [] } } },
  ]);
  const busySeal = await brief.generate("c", { theme: "cozy-village", seed: 3, preferences: "x".repeat(9000), busyWaitMs: 0 });
  assert.equal(calls.length, 2, "busy → one wait-out retry");
  assert.ok(calls[0].userContent.length <= 7_801, "userContent clamped under the route cap");
  assert.equal(busySeal.name, "Busyville", "the wait-out retry seals the real brief");

  // Leave no stub behind for later cases.
  loadedPF.api.postExperienceGeneration = prevPost;
}

// 26. Sanitizer defeats tag reassembly and never leaks an angle bracket
// (CodeQL js/incomplete-multi-character-sanitization): one-pass stripping
// turns "<scr<b>ipt>" into "<script>", and the old order removed every ">"
// before the tag regex could match anything at all.
{
  const sealed = brief.validate(
    {
      scale: "village",
      name: "<scr<b>ipt>Safeton",
      flavor: "A <script src=//evil.example/x.js quiet place.",
      cast: [],
    },
    ctx,
  );
  for (const text of [sealed.name, sealed.flavor]) {
    assert.ok(!text.includes("<") && !text.includes(">"), `no angle bracket survives sanitize: ${text}`);
    assert.ok(!/<script/i.test(text), "no reassembled script tag");
  }
  assert.ok(sealed.name.includes("Safeton"), "legitimate text survives");
}

// 27. Asset loader chases a theme change that lands mid-load (review finding):
// the loading guard used to drop it, leaving the new theme procedural until an
// unrelated reload.
{
  const prevFetch = globalThis.fetch;
  const prevImage = globalThis.Image;
  const requested = [];
  globalThis.fetch = async (url) => ({
    ok: true,
    json: async () =>
      String(url).includes("sprites.json")
        ? { frameWidth: 12, frameHeight: 16, frames: 4, rows: ["down", "up", "left", "right"], actors: {} }
        : { tileSize: 16, columns: 8, tiles: {} },
  });
  globalThis.Image = class {
    set src(value) {
      requested.push(String(value));
      queueMicrotask(() => {
        this.complete = true;
        this.naturalWidth = 128;
        this.onload?.();
      });
    }
  };
  try {
    const core = { host: { packageId: "pixelforge", packageVersion: "0.4.0" } };
    loadedPF.art.setTheme("cozy-village");
    const first = loadedPF.assets.load(core); // in flight
    loadedPF.art.setTheme("sci-fi-colony");
    void loadedPF.assets.load(core); // hits the loading guard — must be QUEUED, not dropped
    await first;
    for (let i = 0; i < 40 && !(loadedPF.assets.status === "ready" && loadedPF.assets._requestedTheme === "sci-fi-colony"); i++) {
      await new Promise((resolve) => setTimeout(resolve, 5));
    }
    assert.equal(loadedPF.assets.status, "ready", "chase load settles");
    assert.equal(loadedPF.assets.atlasTheme, "sci-fi-colony", "the mid-load theme change is chased, not dropped");
    assert.ok(requested.some((u) => u.includes("tiles-sci-fi-colony.png")), "the themed atlas sheet was requested");
  } finally {
    globalThis.fetch = prevFetch;
    globalThis.Image = prevImage;
    loadedPF.art.setTheme("cozy-village");
  }
}

// 28-30. Capability API 1.12 event consumption (onHostEvent) + the travel
// post-await gating: outcomes resolve instantly, stepwise journeys survive
// intermediate hops, and the event path never double-toasts.
{
  const prevGetSpatial = loadedPF.api.getSpatial;
  const spatialState = { loc: "root", revision: 1 };
  loadedPF.api.getSpatial = async () => ({
    definition: { revision: spatialState.revision },
    currentLocationId: spatialState.loc,
    breadcrumb: [{ name: spatialState.loc }],
    destinations: [],
  });
  const toasts = [];
  const core = {
    chatId: "chat-events",
    sim: { world: { zones: {}, bindings: { seeded: true }, startZone: "z1" }, zoneId: "z1", mode: "walk", zone() { return { name: "z1" }; } },
    markDirty() {},
    hud: { toast: (t) => toasts.push(t), refreshChips() {} },
  };
  const spatial = loadedPF.spatial;
  spatial.reset();
  await spatial.refresh(core); // seed availability + _lastLocationId ("root")

  // 28. committed with a matching commandId resolves the journey instantly.
  spatial.pending = { commandId: "cmd-1", destinationId: "bar", name: "Bar", staleCount: 0 };
  spatialState.loc = "bar";
  spatial.onHostEvent(core, { type: "spatial_transition_committed", chatId: core.chatId, data: { commandId: "cmd-1" } });
  assert.equal(spatial.pending, null, "committed event clears the pending journey");
  await new Promise((r) => setTimeout(r, 5));
  assert.equal(spatial._lastLocationId, "bar", "the event-driven refresh applied the new location");

  // 29. stepwise journeys survive intermediate hops; the completing event ends them.
  spatial.pending = { commandId: "cmd-2", destinationId: "far", name: "Far", staleCount: 0 };
  spatial.onHostEvent(core, {
    type: "spatial_transition_committed", chatId: core.chatId,
    data: { commandId: "cmd-2", travel: { mode: "step_by_step", complete: false } },
  });
  assert.ok(spatial.pending && spatial.pending.stepwise, "incomplete stepwise leg keeps (and marks) the pending journey");
  spatialState.loc = "midway";
  await spatial.refresh(core);
  assert.ok(spatial.pending, "an intermediate hop is progress, not supersession");
  spatial.onHostEvent(core, {
    type: "spatial_transition_committed", chatId: core.chatId,
    data: { commandId: "cmd-2", travel: { mode: "step_by_step", complete: true } },
  });
  assert.equal(spatial.pending, null, "the completing event ends the stepwise journey");

  // Rejected event: instant clear + toast; stale-count untouched by event refreshes.
  spatial.pending = { commandId: "cmd-3", destinationId: "nope", name: "Nope", staleCount: 0 };
  spatial.onHostEvent(core, { type: "spatial_transition_rejected", chatId: core.chatId, data: { commandId: "cmd-3", code: "spatial_transition_stale_definition" } });
  assert.equal(spatial.pending, null, "rejected event clears the journey immediately");
  assert.ok(toasts.some((t) => t.includes("stayed put")), "rejection toasts immediately");

  // countStale:false refreshes never burn the two-turn fallback budget.
  spatial.pending = { commandId: "cmd-4", destinationId: "slow", name: "Slow", staleCount: 0 };
  await spatial.refresh(core, { countStale: false });
  await spatial.refresh(core, { countStale: false });
  assert.ok(spatial.pending, "event-driven refreshes don't count toward stale-count");
  await spatial.refresh(core);
  await spatial.refresh(core);
  assert.equal(spatial.pending, null, "turn-driven refreshes still clear a dead journey after two");

  // 30. travel()'s post-await branches act only on their OWN journey: a reject
  // event that already cleared pending must not produce a second toast.
  toasts.length = 0;
  const host = {
    packageId: "pixelforge",
    sendMessage: async () => {
      // Simulate the engine's synthesized reject arriving mid-await.
      spatial.onHostEvent(core, {
        type: "spatial_transition_rejected", chatId: core.chatId,
        data: { commandId: spatial.pending.commandId, code: "spatial_transition_stale_definition" },
      });
      return false;
    },
  };
  core.host = host;
  core.sim.composePrefix = () => "[World]";
  core.sim.commitIntro = () => {};
  await spatial.travel(core, { id: "bar", name: "Bar" });
  assert.ok(toasts.some((t) => t.includes("stayed put")), "the event toast fired");
  assert.ok(!toasts.some((t) => t.includes("isn't accepting")), "no contradictory second toast after the event handled it");

  loadedPF.api.getSpatial = prevGetSpatial;
  spatial.reset();
}

// 31-36. World Maps export (spec §8): seed-stable ids, the definition as the
// idempotency ledger, additive-route retry discipline, and quiet degradation.
{
  const exportScaffold = (seed, chatId, prebuilt) => {
    const w = prebuilt ?? world.build(seed, "cozy-village", brief.defaults("cozy-village", seed));
    const sim = {
      world: w, zoneId: w.startZone, mode: "walk",
      zone() { return this.world.zones[this.zoneId]; },
      teleport() {},
    };
    const core = { chatId, sim, dirty: 0, hud: { toast() {}, refreshChips() {} } };
    core.markDirty = () => { core.dirty++; };
    return { w, core };
  };
  // The zones the export is allowed to touch. The exterior IS the root, and a
  // room inside a building (a dwelling, a shop) stamps mapExport = false, so a
  // case that diffs "every zone" against what was posted has to ask the same
  // question 55-maps-export asks. Case 45 is where the gate itself is pinned.
  const exportableZones = (w) =>
    Object.keys(w.zones).filter((id) => id !== w.startZone && w.zones[id].mapExport !== false);
  const mapsExport = loadedPF.mapsExport;
  const prevGetSpatial = loadedPF.api.getSpatial;
  const prevPostLocations = loadedPF.api.postSpatialLocations;
  const resetExportState = () => {
    mapsExport._done = new WeakSet();
    mapsExport._inFlightWorld = null;
    mapsExport._failed = null;
  };
  /** Bind the root deterministically, then drive the export by hand: the
   *  refresh-triggered fire-and-forget would race the assertions. */
  const bindRoot = async (core) => {
    loadedPF.spatial.reset();
    mapsExport._inFlightWorld = core.sim.world;
    await loadedPF.spatial.refresh(core);
    mapsExport._inFlightWorld = null;
  };

  // 31. Happy path: only missing zones post, as children of the bound root,
  // buildings and wilds keep their kinds, and pre-existing ids re-bind
  // (self-heal) without re-posting. A second run is a no-op.
  {
    const { w, core } = exportScaffold(4242, "chat-export-31");
    const zoneIds = exportableZones(w);
    assert.ok(zoneIds.length >= 2, "the default brief compiles interior and wilds zones");
    const preSeeded = mapsExport.idFor(w, zoneIds[0]);
    let revision = 5;
    let serverLocs = [{ id: "loc-root", kind: "settlement" }, { id: preSeeded, kind: "building" }];
    const posts = [];
    loadedPF.api.getSpatial = async () => ({
      definition: { revision, locations: serverLocs.slice() },
      currentLocationId: "loc-root", breadcrumb: [{ name: "Rootville" }], destinations: [],
    });
    loadedPF.api.postSpatialLocations = async (chatId, body) => {
      posts.push(body);
      assert.equal(body.expectedRevision, revision, "CAS rides the freshest revision");
      serverLocs = serverLocs.concat(body.locations.map((row) => ({ id: row.id, kind: row.kind })));
      revision++;
      return { ok: true, status: 200, body: {} };
    };
    resetExportState();
    await bindRoot(core);
    await mapsExport.maybeSync(core);
    assert.equal(posts.length, 1, "one batch for the missing zones");
    assert.equal(posts[0].locations.length, zoneIds.length - 1, "the pre-seeded id is diffed out");
    for (const row of posts[0].locations) {
      assert.equal(row.parentId, "loc-root", "zones hang under the exterior's bound location");
      const zoneId = row.id.split(".").pop();
      assert.equal(row.kind, w.zones[zoneId].mapKind === "building" ? "building" : "place", "kind follows the zone");
    }
    for (const zoneId of zoneIds) {
      assert.equal(w.bindings[mapsExport.idFor(w, zoneId)], zoneId, `zone ${zoneId} is bound (including the pre-seeded one)`);
      assert.equal(w.zones[zoneId].spatialLocationId, mapsExport.idFor(w, zoneId), "the zone records its location id");
    }
    assert.ok(core.dirty > 0, "bindings persist via a save");
    await mapsExport.maybeSync(core);
    assert.equal(posts.length, 1, "a completed export never re-posts");
  }

  // 32. A stale 409 re-reads and retries with the fresh revision — user edits
  // between our read and write cost one round trip, nothing else.
  {
    const { w, core } = exportScaffold(555, "chat-export-32");
    let revision = 7;
    let serverLocs = [{ id: "loc-root" }];
    const posts = [];
    loadedPF.api.getSpatial = async () => ({
      definition: { revision, locations: serverLocs.slice() },
      currentLocationId: "loc-root", breadcrumb: [{ name: "Rootville" }], destinations: [],
    });
    loadedPF.api.postSpatialLocations = async (chatId, body) => {
      posts.push(body);
      if (posts.length === 1) {
        revision = 9; // someone edited the map mid-flight
        return { ok: false, status: 409, body: { code: "spatial_definition_stale" } };
      }
      serverLocs = serverLocs.concat(body.locations.map((row) => ({ id: row.id })));
      revision++;
      return { ok: true, status: 200, body: {} };
    };
    resetExportState();
    await bindRoot(core);
    await mapsExport.maybeSync(core);
    assert.equal(posts.length, 2, "stale CAS retries once after a re-read");
    assert.equal(posts[1].expectedRevision, 9, "the retry carries the re-read revision");
    assert.ok(Object.keys(w.bindings).length > 1, "the retry completed the bindings");
  }

  // 33. An id conflict means another actor already registered our rows: the
  // re-read diff empties the batch and bindings still land.
  {
    const { w, core } = exportScaffold(777, "chat-export-33");
    const zoneIds = exportableZones(w);
    let raced = false;
    const posts = [];
    loadedPF.api.getSpatial = async () => ({
      definition: {
        revision: 3,
        locations: [{ id: "loc-root" }].concat(
          raced ? zoneIds.map((zoneId) => ({ id: mapsExport.idFor(w, zoneId) })) : [],
        ),
      },
      currentLocationId: "loc-root", breadcrumb: [{ name: "Rootville" }], destinations: [],
    });
    loadedPF.api.postSpatialLocations = async () => {
      posts.push(1);
      raced = true; // a second tab beat us to every id
      return { ok: false, status: 409, body: { code: "spatial_location_conflict" } };
    };
    resetExportState();
    await bindRoot(core);
    await mapsExport.maybeSync(core);
    assert.equal(posts.length, 1, "the conflict is not retried blindly");
    assert.equal(w.bindings[mapsExport.idFor(w, zoneIds[0])], zoneIds[0], "already-registered ids still bind");
    assert.ok(mapsExport._done.has(w), "the run completes");
  }

  // 34. Older maps package (route absent): quiet skip, no bindings to
  // locations that do not exist, and no per-turn retry hammering.
  {
    const { w, core } = exportScaffold(888, "chat-export-34");
    const posts = [];
    loadedPF.api.getSpatial = async () => ({
      definition: { revision: 1, locations: [{ id: "loc-root" }] },
      currentLocationId: "loc-root", breadcrumb: [{ name: "Rootville" }], destinations: [],
    });
    loadedPF.api.postSpatialLocations = async () => {
      posts.push(1);
      return { ok: false, status: 404, body: null };
    };
    resetExportState();
    await bindRoot(core);
    await mapsExport.maybeSync(core);
    await mapsExport.maybeSync(core);
    assert.equal(posts.length, 1, "404 marks the world done for this session");
    assert.equal(Object.keys(w.bindings).length, 1, "only the root binding exists — nothing binds to absent locations");
  }

  // 35. A live editor moving the revision forever: two no-progress retries,
  // then back off — never a duel, and the backoff holds within the window.
  {
    const { core } = exportScaffold(999, "chat-export-35");
    let revision = 1;
    const posts = [];
    loadedPF.api.getSpatial = async () => ({
      definition: { revision: ++revision, locations: [{ id: "loc-root" }] },
      currentLocationId: "loc-root", breadcrumb: [{ name: "Rootville" }], destinations: [],
    });
    loadedPF.api.postSpatialLocations = async () => {
      posts.push(1);
      return { ok: false, status: 409, body: { code: "spatial_definition_stale" } };
    };
    resetExportState();
    await bindRoot(core);
    await mapsExport.maybeSync(core);
    assert.equal(posts.length, 3, "three attempts, then surrender");
    assert.ok(mapsExport._failed, "the failure is recorded for backoff");
    await mapsExport.maybeSync(core);
    assert.equal(posts.length, 3, "the backoff window suppresses immediate retries");
  }

  // 36. A chat switch mid-flight must not write into the new chat's world:
  // same generation discipline refresh() and travel() use.
  {
    const { w, core } = exportScaffold(1234, "chat-export-36");
    loadedPF.api.getSpatial = async () => ({
      definition: { revision: 2, locations: [{ id: "loc-root" }] },
      currentLocationId: "loc-root", breadcrumb: [{ name: "Rootville" }], destinations: [],
    });
    loadedPF.api.postSpatialLocations = async () => {
      core.chatId = "some-other-chat"; // the user switched chats mid-await
      return { ok: true, status: 200, body: {} };
    };
    resetExportState();
    await bindRoot(core);
    await mapsExport.maybeSync(core);
    assert.equal(Object.keys(w.bindings).length, 1, "no export bindings written after a chat switch");
    assert.ok(!mapsExport._done.has(w), "the run does not mark itself complete");
  }

  // 37. Adoption: a same-named root child authored before the export (hand
  // edits, wizard map instructions) is bound instead of twinned; only truly
  // new zones post. A location already bound to another zone never adopts.
  {
    const { w, core } = exportScaffold(2468, "chat-export-37");
    const zoneIds = exportableZones(w);
    const adoptedZone = zoneIds[0];
    const adoptedName = w.zones[adoptedZone].name;
    const posts = [];
    let serverLocs = [
      { id: "loc-root" },
      { id: "authored-1", parentId: "loc-root", name: `  ${adoptedName.toUpperCase()}  ` },
    ];
    loadedPF.api.getSpatial = async () => ({
      definition: { revision: 4, locations: serverLocs.slice() },
      currentLocationId: "loc-root", breadcrumb: [{ name: "Rootville" }], destinations: [],
    });
    loadedPF.api.postSpatialLocations = async (chatId, body) => {
      posts.push(body);
      serverLocs = serverLocs.concat(body.locations.map((row) => ({ id: row.id })));
      return { ok: true, status: 200, body: {} };
    };
    resetExportState();
    await bindRoot(core);
    await mapsExport.maybeSync(core);
    assert.ok(
      !posts.flatMap((p) => p.locations).some((row) => row.name === adoptedName),
      "the adopted zone is never posted as a twin",
    );
    assert.equal(w.bindings["authored-1"], adoptedZone, "the authored location is bound (name match is trim+case-insensitive)");
    assert.equal(w.zones[adoptedZone].spatialLocationId, "authored-1", "the zone records the adopted id");
    for (const zoneId of zoneIds.slice(1)) {
      assert.equal(w.bindings[mapsExport.idFor(w, zoneId)], zoneId, "non-adopted zones still create and bind pf ids");
    }
  }

  // 37b. A restored save already carries a prior adoption: re-planning must
  // KEEP adopting the location bound to the same zone, never flip back to
  // creating a twin (live-found regression on the Kepler playtest).
  {
    const { w, core } = exportScaffold(2468, "chat-export-37b");
    const zoneIds = exportableZones(w);
    const adoptedZone = zoneIds[0];
    const adoptedName = w.zones[adoptedZone].name;
    const posts = [];
    let serverLocs = [
      { id: "loc-root" },
      { id: "authored-1", parentId: "loc-root", name: adoptedName },
    ];
    loadedPF.api.getSpatial = async () => ({
      definition: { revision: 4, locations: serverLocs.slice() },
      currentLocationId: "loc-root", breadcrumb: [{ name: "Rootville" }], destinations: [],
    });
    loadedPF.api.postSpatialLocations = async (chatId, body) => {
      posts.push(body);
      serverLocs = serverLocs.concat(body.locations.map((row) => ({ id: row.id })));
      return { ok: true, status: 200, body: {} };
    };
    resetExportState();
    await bindRoot(core);
    w.bindings["authored-1"] = adoptedZone; // the save restored last session's adoption
    await mapsExport.maybeSync(core);
    assert.ok(
      !posts.flatMap((p) => p.locations).some((row) => row.name === adoptedName),
      "an already-bound adoption never flips back to creating a twin",
    );
    assert.equal(w.bindings["authored-1"], adoptedZone, "the adoption binding survives");
    // A location bound to a DIFFERENT zone is never stolen: it creates instead.
    const otherZone = zoneIds[1];
    if (otherZone) {
      resetExportState();
      w.bindings["authored-1"] = otherZone; // user rebound it (or a conflicting save)
      delete w.bindings[mapsExport.idFor(w, adoptedZone)];
      await mapsExport.maybeSync(core);
      assert.equal(w.bindings["authored-1"], otherZone, "a foreign binding is never stolen");
      assert.equal(w.bindings[mapsExport.idFor(w, adoptedZone)], adoptedZone, "the shadowed zone creates its own id instead");
    }
  }

  // 38. An accepted batch whose rows never appear in the re-read (a proxy
  // eating writes, a stale read replica) surrenders instead of posting
  // forever — the regression that OOM'd the harness when first written.
  {
    const { core } = exportScaffold(3690, "chat-export-38");
    const posts = [];
    loadedPF.api.getSpatial = async () => ({
      definition: { revision: 1, locations: [{ id: "loc-root" }] },
      currentLocationId: "loc-root", breadcrumb: [{ name: "Rootville" }], destinations: [],
    });
    loadedPF.api.postSpatialLocations = async () => {
      posts.push(1);
      return { ok: true, status: 200, body: {} }; // accepted, but the GET never reflects it
    };
    resetExportState();
    await bindRoot(core);
    await mapsExport.maybeSync(core);
    assert.equal(posts.length, 3, "three attempts with no visible progress, then surrender");
    assert.ok(mapsExport._failed, "the failure is recorded for backoff");
  }

  // 39. A same-chat, same-seed REBUILD (brief arrival, rewind) is a new world
  // object: completion state must not carry over — the rebuilt world re-syncs,
  // the diff makes it a re-bind, and the self-heal actually runs (the string
  // done-key suppressed all of this: review finding).
  {
    const { w, core } = exportScaffold(1357, "chat-export-39");
    const zoneIds = exportableZones(w);
    let serverLocs = [{ id: "loc-root" }];
    const posts = [];
    loadedPF.api.getSpatial = async () => ({
      definition: { revision: 2, locations: serverLocs.slice() },
      currentLocationId: "loc-root", breadcrumb: [{ name: "Rootville" }], destinations: [],
    });
    loadedPF.api.postSpatialLocations = async (chatId, body) => {
      posts.push(body);
      serverLocs = serverLocs.concat(body.locations.map((row) => ({ id: row.id })));
      return { ok: true, status: 200, body: {} };
    };
    resetExportState();
    await bindRoot(core);
    await mapsExport.maybeSync(core);
    assert.ok(mapsExport._done.has(w), "first world completes");
    // The rebuild: same chat, same seed, fresh world object with empty bindings.
    const sealed = brief.defaults("cozy-village", 1357);
    const w2 = world.build(1357, "cozy-village", sealed);
    core.sim = {
      world: w2, zoneId: w2.startZone, mode: "walk",
      zone() { return this.world.zones[this.zoneId]; },
      teleport() {},
    };
    w2.bindings["loc-root"] = w2.startZone;
    await mapsExport.maybeSync(core);
    assert.ok(mapsExport._done.has(w2), "the rebuilt world syncs despite identical chat+seed");
    assert.equal(posts.length, 1, "nothing re-posts — the definition diff turns the re-sync into a re-bind");
    for (const zoneId of zoneIds) {
      assert.equal(w2.bindings[mapsExport.idFor(w2, zoneId)], zoneId, "the rebuilt world's bindings self-heal");
    }
  }

  // 40. The pre-brief boot world of a generation-enabled chat (world.interim,
  // stamped by 60-save) never exports — its throwaway zones would pollute the
  // map forever on an additive route.
  {
    const { w, core } = exportScaffold(8642, "chat-export-40");
    w.interim = true;
    const posts = [];
    loadedPF.api.getSpatial = async () => ({
      definition: { revision: 1, locations: [{ id: "loc-root" }] },
      currentLocationId: "loc-root", breadcrumb: [{ name: "Rootville" }], destinations: [],
    });
    loadedPF.api.postSpatialLocations = async () => {
      posts.push(1);
      return { ok: true, status: 200, body: {} };
    };
    resetExportState();
    await bindRoot(core);
    await mapsExport.maybeSync(core);
    assert.equal(posts.length, 0, "an interim world never posts");
    assert.ok(!mapsExport._done.has(w), "and is not marked done — the final world will sync");
  }

  // 41. A shared-world-linked chat skips: posting would silently stage
  // unpublished draft edits to a communal world. Not marked done, so
  // unlinking re-enables the export.
  {
    const { w, core } = exportScaffold(9753, "chat-export-41");
    const posts = [];
    loadedPF.api.getSpatial = async () => ({
      definition: { revision: 1, locations: [{ id: "loc-root" }] },
      currentLocationId: "loc-root", breadcrumb: [{ name: "Rootville" }], destinations: [],
      sharedWorld: { mode: "linked", worldId: "world-1", pendingChanges: false },
    });
    loadedPF.api.postSpatialLocations = async () => {
      posts.push(1);
      return { ok: true, status: 200, body: {} };
    };
    resetExportState();
    await bindRoot(core);
    await mapsExport.maybeSync(core);
    assert.equal(posts.length, 0, "a linked chat never posts");
    assert.ok(!mapsExport._done.has(w), "and is not marked done");
  }

  // 42. A stale root binding (map replaced or root archived) prunes the dead
  // bindings instead of 400-looping forever; the emptied table re-seeds on
  // the next refresh.
  {
    const { w, core } = exportScaffold(1122, "chat-export-42");
    const posts = [];
    loadedPF.api.getSpatial = async () => ({
      definition: { revision: 5, locations: [{ id: "loc-new-root" }] },
      currentLocationId: "loc-new-root", breadcrumb: [{ name: "New Root" }], destinations: [],
    });
    loadedPF.api.postSpatialLocations = async () => {
      posts.push(1);
      return { ok: false, status: 400, body: { code: "spatial_replacement_invalid" } };
    };
    resetExportState();
    loadedPF.spatial.reset();
    mapsExport._inFlightWorld = core.sim.world;
    await loadedPF.spatial.refresh(core);
    mapsExport._inFlightWorld = null;
    // The save restored bindings from BEFORE the map was replaced.
    delete w.bindings["loc-new-root"];
    w.bindings["loc-dead-root"] = w.startZone;
    w.bindings[mapsExport.idFor(w, Object.keys(w.zones).find((id) => id !== w.startZone))] = "z2";
    core.dirty = 0;
    await mapsExport.maybeSync(core);
    assert.equal(posts.length, 0, "nothing posts under a dead root");
    assert.equal(Object.keys(w.bindings).length, 0, "every dead binding is pruned so re-seeding can run");
    assert.ok(core.dirty > 0, "the prune persists");
    assert.ok(!mapsExport._done.has(w), "the world is not done — it re-syncs under the new root");
  }

  // 43. A deliberate refusal (archived parent raced in, the 500-location cap)
  // marks the world done for the session — no 60-second retry drumbeat.
  {
    const { w, core } = exportScaffold(3344, "chat-export-43");
    const posts = [];
    loadedPF.api.getSpatial = async () => ({
      definition: { revision: 3, locations: [{ id: "loc-root" }] },
      currentLocationId: "loc-root", breadcrumb: [{ name: "Rootville" }], destinations: [],
    });
    loadedPF.api.postSpatialLocations = async () => {
      posts.push(1);
      return { ok: false, status: 400, body: { code: "spatial_replacement_invalid" } };
    };
    resetExportState();
    await bindRoot(core);
    await mapsExport.maybeSync(core);
    mapsExport._failed = null; // isolate the done-marking from the backoff window
    await mapsExport.maybeSync(core);
    assert.equal(posts.length, 1, "a 4xx refusal is terminal for the session, not retried");
    assert.ok(mapsExport._done.has(w), "the world is marked done");
  }

  // 44. An oscillating map (an editor archiving/restoring an adoptable
  // between every CAS attempt flips a zone between adoption and creation, so
  // consecutive no-progress comparisons never fire) still terminates via the
  // absolute attempt budget — CodeRabbit finding on #389.
  {
    const { w, core } = exportScaffold(5566, "chat-export-44");
    const zoneIds = exportableZones(w);
    const flipName = w.zones[zoneIds[0]].name;
    let reads = 0;
    const posts = [];
    loadedPF.api.getSpatial = async () => ({
      definition: {
        revision: 10 + reads,
        locations: [
          { id: "loc-root" },
          // Present on every OTHER read: adoption flips to creation and back,
          // so missing.length oscillates and never repeats consecutively.
          ...(reads++ % 2 === 0 ? [{ id: "flippy", parentId: "loc-root", name: flipName }] : []),
        ],
      },
      currentLocationId: "loc-root", breadcrumb: [{ name: "Rootville" }], destinations: [],
    });
    loadedPF.api.postSpatialLocations = async () => {
      posts.push(1);
      return { ok: false, status: 409, body: { code: "spatial_definition_stale" } };
    };
    resetExportState();
    await bindRoot(core);
    await mapsExport.maybeSync(core);
    assert.ok(posts.length <= 8, `the absolute budget bounds the loop (posted ${posts.length} times)`);
    assert.ok(mapsExport._failed, "the surrender is recorded for backoff");
  }

  // 45. The export gate: a building is ONE location and its floors are rooms
  // inside it, so a zone stamped mapExport = false gets no row and no binding,
  // while a NAMED brief place — the sanctuary here — still exports its single
  // row. This route is additive with NO delete: a row posted to a player's real
  // map is permanent, which is why the gate ships with the zone type and not a
  // release later.
  {
    const sealed = brief.validate(
      {
        scale: "village",
        name: "Bellford",
        places: [
          { kind: "sanctuary", name: "St. Ilde's", flavor: "Cold stone, warm candles." },
          { kind: "gathering", name: "The Bell" },
          { kind: "wilds", name: "The Reach" },
        ],
        cast: [
          { name: "Sera", role: "chaplain", kind: "elder", tint: "rose", home: "Bellford", household: 1 },
          { name: "Perrin", role: "innkeep", kind: "host", tint: "amber", home: "The Bell", household: 2 },
          { name: "Alder", role: "reeve", kind: "leader", tint: "blue", home: "Bellford", household: 3 },
          { name: "Tam", role: "farmer", kind: "grower", tint: "green", home: "Bellford", household: 4 },
          { name: "Cor", role: "shopkeep", kind: "merchant", tint: "teal", home: "Bellford", household: 5 },
        ],
      },
      { theme: "cozy-village", seed: 3131 },
    );
    const built = world.build(3131, "cozy-village", sealed);
    const churchId = Object.keys(built.zones).find((id) => built.zones[id].name === "St. Ilde's");
    const innId = Object.keys(built.zones).find((id) => built.zones[id].name === "The Bell");
    assert.ok(churchId && innId, "the sanctuary and the gathering both compiled");
    assert.equal(built.zones[churchId].mapExport, true, "a named place exports by default");
    // The compiled rooms — the dwelling and the shop — stamp the gate themselves.
    // (Five specials against a village's eight lots leave one dwelling slot, so
    // the four root households share a roof; one dwelling is what this fixture
    // is expected to build.)
    const roomIds = Object.keys(built.zones).filter((id) => built.zones[id].mapExport === false);
    assert.ok(
      roomIds.some((id) => built.zones[id].name.endsWith("'s home")) &&
        roomIds.some((id) => built.zones[id].name.endsWith("'s shop")),
      `the fixture compiled a dwelling and a shop (${roomIds.map((id) => built.zones[id].name).join(", ")})`,
    );
    // …and FLOORS (0.8.0). "One building, one location — never a row per floor"
    // below is a claim about zones that have to exist for it to mean anything:
    // the church carries a bell tower and the inn a cellar in this fixture.
    assert.ok(
      roomIds.includes(`${churchId}u`) && roomIds.includes(`${innId}b`),
      `the fixture compiled sub-floors (${roomIds.join(", ")})`,
    );
    // The gathering is stamped by HAND as well, so the gate is proven for a zone
    // type that does not set it itself: it is a property of the flag, not of
    // which zone kinds happen to carry it today.
    built.zones[innId].mapExport = false;
    const { w, core } = exportScaffold(3131, "chat-export-45", built);
    let serverLocs = [{ id: "loc-root" }];
    const posted = [];
    loadedPF.api.getSpatial = async () => ({
      definition: { revision: 2, locations: serverLocs.slice() },
      currentLocationId: "loc-root", breadcrumb: [{ name: "Rootville" }], destinations: [],
    });
    loadedPF.api.postSpatialLocations = async (chatId, body) => {
      posted.push(...body.locations);
      serverLocs = serverLocs.concat(body.locations.map((row) => ({ id: row.id })));
      return { ok: true, status: 200, body: {} };
    };
    resetExportState();
    await bindRoot(core);
    await mapsExport.maybeSync(core);
    assert.ok(
      posted.some((row) => row.name === "St. Ilde's" && row.kind === "building"),
      "the church exports its single row",
    );
    assert.equal(
      posted.filter((row) => row.name === "St. Ilde's").length,
      1,
      "one building, one location — never a row per floor",
    );
    assert.ok(!posted.some((row) => row.name === "The Bell"), "a zone stamped mapExport = false never posts");
    assert.equal(w.bindings[mapsExport.idFor(w, innId)], undefined, "and never binds a location it did not create");
    assert.equal(w.zones[innId].spatialLocationId, null, "the excluded zone records no location");
    // The compiled rooms take the same path: a dwelling and a shop are a floor
    // inside a building the settlement already contains, never a destination of
    // their own — and this route can never take a wrong row back.
    for (const roomId of roomIds) {
      const room = w.zones[roomId];
      assert.ok(!posted.some((row) => row.name === room.name), `${room.name} is a room, so it never posts`);
      assert.equal(w.bindings[mapsExport.idFor(w, roomId)], undefined, `${room.name} binds no location`);
      assert.equal(room.spatialLocationId, null, `${room.name} records no location`);
    }
    assert.equal(w.bindings[mapsExport.idFor(w, churchId)], churchId, "the church binds");
    // Non-vacuous: the wilds zone proves the run really did export its peers.
    const wildsId = Object.keys(w.zones).find((id) => w.zones[id].name === "The Reach");
    assert.equal(w.bindings[mapsExport.idFor(w, wildsId)], wildsId, "the other named places still export");
  }

  loadedPF.api.getSpatial = prevGetSpatial;
  loadedPF.api.postSpatialLocations = prevPostLocations;
  resetExportState();
  loadedPF.spatial.reset();
}

// 14. NPC daypart schedules. The compiler bakes location handles onto each NPC
// and the Sim re-places them as the clock crosses a daypart boundary.
{
  const sealed = brief.validate(
    {
      scale: "village",
      name: "Dayhold",
      places: [{ kind: "gathering", name: "The Lantern" }],
      cast: [
        { name: "Mira", role: "innkeep", kind: "host", tint: "amber", home: "The Lantern", household: 1 },
        { name: "Tolm", role: "smith", kind: "maker", tint: "green", home: "Dayhold", household: 2 },
        { name: "Gart", role: "watch", kind: "guard", tint: "red", home: "Dayhold", household: 3 },
        { name: "Peb", role: "cooper", kind: "folk", tint: "blue", home: "Dayhold", household: 4 },
        { name: "Wisp", role: "drifter", kind: "wanderer", tint: "rose", home: "Dayhold", household: 5, standing: "transient" },
      ],
    },
    ctx,
  );
  const w = world.build(31, "cozy-village", sealed);
  checkWorld(w, sealed, "schedules");
  const innId = Object.entries(sealed._ids.zones).find(([, n]) => n === "The Lantern")[0];
  const findNpc = (name) => {
    for (const zoneId in w.zones) {
      const npc = w.zones[zoneId].npcs.find((n) => n.name === name);
      if (npc) return { zoneId, npc };
    }
    return null;
  };

  // Every NPC carries a schedule, and every handle points at a real zone.
  for (const zoneId in w.zones) {
    for (const npc of w.zones[zoneId].npcs) {
      assert.ok(npc._sched, `${npc.name} carries a schedule`);
      assert.ok(npc._sched.post && w.zones[npc._sched.post.zoneId], `${npc.name} post handle resolves to a zone`);
      if (npc._sched.home) assert.ok(w.zones[npc._sched.home.zoneId], `${npc.name} home handle resolves to a zone`);
    }
  }

  const sim = new loadedPF.Sim(w);
  const dayOf = (min) => {
    sim.clockMin = min;
    sim.resolveSchedules();
  };

  // Daypart thresholds line up with the darkness() bands.
  assert.equal(sim.daypart(8 * 60), "day", "08:00 is day");
  assert.equal(sim.daypart(19 * 60), "dusk", "19:00 is dusk");
  assert.equal(sim.daypart(23 * 60), "night", "23:00 is night");
  assert.equal(sim.daypart(6 * 60), "dawn", "06:00 is dawn");

  // Midday: the smith works the shop; at night he is at his dwelling door.
  dayOf(12 * 60);
  const smithDay = JSON.stringify(findNpc("Tolm").npc.wander);
  dayOf(23 * 60);
  const smithNight = JSON.stringify(findNpc("Tolm").npc.wander);
  assert.notEqual(smithDay, smithNight, "the smith's night box differs from the working one");

  // The watch keeps the night: same box by day and after dark.
  dayOf(12 * 60);
  const guardDay = JSON.stringify(findNpc("Gart").npc.wander);
  dayOf(23 * 60);
  assert.equal(JSON.stringify(findNpc("Gart").npc.wander), guardDay, "the guard keeps the night watch at their post");

  // The innkeeper never leaves the inn, day or night.
  for (const min of [8 * 60, 23 * 60]) {
    dayOf(min);
    assert.equal(findNpc("Mira").zoneId, innId, "the innkeeper stays in the inn");
  }

  // Cross-zone relocation: the drifter loiters in the settlement by day and
  // takes a bed at the inn at night — spliced between zone arrays, exactly once.
  // The berth is UP THE STAIRS (0.8.0 floors), which is the same splice: a floor
  // is a zone, so a guest going to bed crosses one exactly as they always did.
  dayOf(12 * 60);
  const drifterDay = findNpc("Wisp");
  dayOf(23 * 60);
  const drifterNight = findNpc("Wisp");
  assert.equal(drifterNight.zoneId, `${innId}u`, "the drifter sleeps in the inn's guest rooms");
  assert.notEqual(drifterDay.zoneId, drifterNight.zoneId, "the drifter actually changed zone");
  let copies = 0;
  for (const zoneId in w.zones) copies += w.zones[zoneId].npcs.filter((n) => n.name === "Wisp").length;
  assert.equal(copies, 1, "a relocated NPC exists in exactly one zone (no splice duplication)");

  // Relocation never drops an NPC on a solid tile, at any daypart.
  for (const min of [6 * 60, 12 * 60, 19 * 60, 23 * 60]) {
    dayOf(min);
    for (const zoneId in w.zones) {
      const z = w.zones[zoneId];
      for (const npc of z.npcs) {
        const x = Math.round(npc.x);
        const y = Math.round(npc.y);
        assert.ok(x >= 0 && x < z.w && y >= 0 && y < z.h, `${npc.name} in bounds at ${min}`);
        assert.equal(z.solid[z.w * y + x], 0, `${npc.name} stands on open ground at ${min} in ${zoneId}`);
      }
    }
  }

  // Resolution is deterministic and idempotent: same clock, same placement.
  dayOf(19 * 60);
  const dusk = JSON.stringify(Object.keys(w.zones).map((id) => w.zones[id].npcs.map((n) => `${n.name}@${n.x},${n.y}`)));
  sim.resolveSchedules();
  const duskAgain = JSON.stringify(
    Object.keys(w.zones).map((id) => w.zones[id].npcs.map((n) => `${n.name}@${n.x},${n.y}`)),
  );
  assert.equal(dusk, duskAgain, "re-resolving the same daypart changes nothing");

  // A GM-held NPC is not yanked home by a boundary crossing.
  dayOf(12 * 60);
  const held = findNpc("Peb").npc;
  held._hold = true;
  const heldBox = JSON.stringify(held.wander);
  dayOf(23 * 60);
  assert.equal(JSON.stringify(held.wander), heldBox, "an NPC on GM hold ignores the schedule");
  delete held._hold;

  // The header carries the daypart so the GM narrates the light we render.
  dayOf(19 * 60);
  assert.ok(sim.header().includes("(dusk)"), `the header names the daypart (${sim.header()})`);

  // NPCs sharing a destination box must not stack: talk-targeting picks the
  // nearest with a strict <, so anyone underneath the top sprite would be
  // permanently unreachable. Review finding — a plain box-center placement put
  // most of the cast on one plaza tile at midday.
  for (const min of [12 * 60, 23 * 60]) {
    dayOf(min);
    for (const zoneId in w.zones) {
      const seen = new Map();
      for (const npc of w.zones[zoneId].npcs) {
        const tile = `${Math.round(npc.x)},${Math.round(npc.y)}`;
        assert.ok(!seen.has(tile), `${npc.name} and ${seen.get(tile)} share tile ${tile} in ${zoneId} at ${min}`);
        seen.set(tile, npc.name);
      }
    }
  }

  // Schedules are runtime-only state: `_sched` hangs off the live NPC object,
  // which the snapshot never walks (60-save stores a fixed scalar field list and
  // no NPC data at all), so schedules add zero save fields. What this harness
  // can prove is the property that makes that safe — placement is a pure
  // function of the clock, so a rebuild at a restored time reproduces it.
  dayOf(23 * 60);
  const nightPlacement = JSON.stringify(
    Object.keys(w.zones).map((id) => w.zones[id].npcs.map((n) => `${n.name}@${n.x},${n.y}`)),
  );
  const rebuilt = world.build(31, "cozy-village", sealed);
  const rebuiltSim = new loadedPF.Sim(rebuilt);
  rebuiltSim.clockMin = 23 * 60;
  rebuiltSim.resolveSchedules();
  assert.equal(
    JSON.stringify(Object.keys(rebuilt.zones).map((id) => rebuilt.zones[id].npcs.map((n) => `${n.name}@${n.x},${n.y}`))),
    nightPlacement,
    "a rebuild at the same clock reproduces placement exactly (no save fields needed)",
  );
}

// 14b. The clock advances while walking and FREEZES during dialogue, so a
// conversation never burns the afternoon or relocates the NPC being talked to.
{
  const sealed = brief.defaults("cozy-village", 12345);
  const sim = new loadedPF.Sim(world.build(12345, "cozy-village", sealed));
  sim.clockMin = 12 * 60;
  sim.mode = "walk";
  const before = sim.clockMin;
  for (let i = 0; i < 600; i++) sim.step(1 / 60, {});
  assert.ok(sim.clockMin > before, `walking advances the clock (${before} -> ${sim.clockMin})`);

  sim.mode = "dialogue";
  const frozen = sim.clockMin;
  for (let i = 0; i < 600; i++) sim.step(1 / 60, {});
  assert.equal(sim.clockMin, frozen, "dialogue freezes the clock");

  // wait-until jumps to the next daypart boundary and re-places everyone.
  sim.mode = "walk";
  sim.clockMin = 12 * 60;
  assert.ok(sim.waitUntil("night"), "wait-until succeeds in walk mode");
  assert.equal(sim.clockMin, 21 * 60, "wait-until lands on the daypart boundary");
  assert.equal(sim.daypart(), "night", "and the daypart follows");
  sim.mode = "dialogue";
  assert.equal(sim.waitUntil("dawn"), false, "wait-until refuses mid-conversation");
}

// 14c. NPCs actually WALK. The arrival snap used to test "near any integer",
// which matched the tile an NPC was still standing on — at the shipped fixed
// 1/60s step one move covers 0.027 tiles, so every move was cancelled on its
// first frame and the wander had never moved anyone. Drive the real fixed step.
{
  const sealed = brief.defaults("cozy-village", 909);
  const w = world.build(909, "cozy-village", sealed);
  const sim = new loadedPF.Sim(w);
  sim.mode = "walk";
  const z = sim.zone();
  assert.ok(z.npcs.length > 0, "the settlement has NPCs to move");
  // Key the start tiles BY NAME. A substring test over one joined string lets a
  // name that is a suffix of another ("Ada" inside "Wanda") match the wrong
  // entry when both stand on the same tile, so a genuinely frozen NPC would
  // read as unmoved-but-accounted-for and a movement regression could pass.
  const start = new Map(z.npcs.map((n) => [n.name, `${Math.round(n.x)},${Math.round(n.y)}`]));
  // Two in-game hours at the shipped 1/60s timestep.
  for (let i = 0; i < 60 * 60 * 2; i++) sim.step(1 / 60, {});
  const moved = z.npcs.filter((n) => start.get(n.name) !== `${Math.round(n.x)},${Math.round(n.y)}`);
  assert.ok(
    moved.length > 0,
    `at least one NPC wandered to a new tile (start ${[...start].map(([n, at]) => `${n}@${at}`).join("|")})`,
  );
  // And wandering never walks anyone through a wall or out of their box.
  for (const npc of z.npcs) {
    const x = Math.round(npc.x);
    const y = Math.round(npc.y);
    assert.equal(z.solid[z.w * y + x], 0, `${npc.name} never wanders onto a solid tile`);
    assert.ok(
      x >= npc.wander.x0 - 1 && x <= npc.wander.x1 + 1 && y >= npc.wander.y0 - 1 && y <= npc.wander.y1 + 1,
      `${npc.name} stays in its wander box`,
    );
  }
}

// 14e. Playtest findings: the NPC you are talking to holds still, nobody stands
// in a doorway or on a portal, and a stall merchant stays behind their counter.
{
  const sealed = brief.validate(
    {
      scale: "village",
      name: "Standfast",
      places: [{ kind: "gathering", name: "The Lamp" }],
      cast: [
        { name: "Ada", role: "reeve", kind: "leader", tint: "blue", home: "Standfast", household: 1 },
        { name: "Ben", role: "cooper", kind: "folk", tint: "green", home: "Standfast", household: 2 },
        { name: "Cyd", role: "innkeep", kind: "host", tint: "amber", home: "The Lamp", household: 3 },
        { name: "Sol", role: "trader", kind: "merchant", tint: "rose", home: "Standfast", household: 4, standing: "transient" },
      ],
    },
    ctx,
  );
  const w = world.build(11, "cozy-village", sealed);
  checkWorld(w, sealed, "playtest-fixes");
  const sim = new loadedPF.Sim(w);
  const v = w.zones.z1;

  // A stall merchant tends the counter: a single row, never the open street.
  // ASSERT the preconditions rather than guarding on them — skipping when the
  // merchant stops getting a stall (or stops being spread:false) would make the
  // case pass while checking nothing at all.
  const sol = v.npcs.find((n) => n.name === "Sol");
  assert.ok(sol, "the transient merchant tends their stall in the settlement");
  assert.equal(sol._sched.post.spread, false, "a stall is private geometry, so its placement is not hashed");
  assert.equal(sol.wander.y0, sol.wander.y1, "the stall merchant's box is the counter row only");

  // Nobody is placed in a doorway or on a portal, at any daypart.
  for (const min of [6 * 60, 12 * 60, 19 * 60, 23 * 60]) {
    sim.clockMin = min;
    sim.resolveSchedules();
    for (const zoneId in w.zones) {
      const z = w.zones[zoneId];
      for (const npc of z.npcs) {
        const x = Math.round(npc.x);
        const y = Math.round(npc.y);
        assert.notEqual(z.object[z.w * y + x], "door", `${npc.name} does not stand in a doorway at ${min}`);
        assert.ok(
          !z.portals.some((p) => p.x === x && p.y === y),
          `${npc.name} does not stand on a portal at ${min}`,
        );
      }
    }
  }

  // Wandering never walks anyone into a doorway either.
  sim.mode = "walk";
  sim.clockMin = 12 * 60;
  sim.resolveSchedules();
  for (let i = 0; i < 60 * 60 * 2; i++) sim.step(1 / 60, {});
  for (const zoneId in w.zones) {
    const z = w.zones[zoneId];
    for (const npc of z.npcs) {
      const x = Math.round(npc.x);
      const y = Math.round(npc.y);
      assert.notEqual(z.object[z.w * y + x], "door", `${npc.name} never wanders into a doorway`);
    }
  }

  // The NPC being talked to stands still while the player is in dialogue.
  const partner = v.npcs[0];
  sim.mode = "dialogue";
  sim.nearNpc = partner;
  const held = `${partner.x},${partner.y}`;
  for (let i = 0; i < 60 * 60; i++) sim.step(1 / 60, {});
  assert.equal(`${partner.x},${partner.y}`, held, "the conversation partner holds still during dialogue");
}

// 14g. NPCs never share a tile WHILE WANDERING. Placement alone was not enough:
// the wander step only checked terrain, so two NPCs could pick the same free
// tile and slide through each other (playtest finding). Needs a CROWDED zone to
// reproduce — a full cast of folk all converge on the plaza at midday.
{
  const cast = [];
  for (let i = 0; i < 8; i++) {
    cast.push({
      name: `Folk${i}`,
      role: "villager",
      kind: "folk",
      tint: ["blue", "green", "amber", "rose", "teal", "violet", "orange", "grey"][i],
      home: "Crowdham",
      household: i + 1,
    });
  }
  const sealed = brief.validate({ scale: "village", name: "Crowdham", cast }, ctx);
  const w = world.build(21, "cozy-village", sealed);
  const sim = new loadedPF.Sim(w);
  sim.mode = "walk";
  sim.clockMin = 12 * 60; // folk -> the plaza, all sharing one box
  sim.resolveSchedules();
  const v = w.zones.z1;
  // Guard against a vacuous pass: one NPC can never collide with itself.
  assert.ok(v.npcs.length >= 5, `the plaza is genuinely crowded (${v.npcs.length} NPCs)`);
  let collisions = 0;
  for (let i = 0; i < 60 * 60 * 3; i++) {
    sim.step(1 / 60, {});
    const seen = new Set();
    for (const npc of v.npcs) {
      const tile = `${Math.round(npc.x)},${Math.round(npc.y)}`;
      if (seen.has(tile)) collisions++;
      seen.add(tile);
    }
  }
  assert.equal(collisions, 0, `no two NPCs share a tile while wandering (${collisions} colliding samples)`);
}

// 14i. Relocation must spread too. 14g pins the WANDER step; this pins the
// PLACEMENT. The cross-zone branch resolved its tile without the spread key, so
// every transient bedding down at the same inn arrived on the box's center —
// and a sprite under another sprite can never be selected by talk-targeting,
// which picks the nearest with a strict <. Needs several NPCs converging on ONE
// box from ANOTHER zone, which the default briefs never produce: the loiter
// rotation posts some transients at the inn already, and those take the in-zone
// path. Six of them guarantees at least two arrive from outside.
{
  const cast = [{ name: "Mira", role: "innkeep", kind: "host", tint: "amber", home: "The Lantern", household: 1 }];
  for (let i = 0; i < 6; i++) {
    cast.push({
      name: `Drifter${i}`,
      role: "drifter",
      kind: "wanderer",
      tint: ["blue", "green", "rose", "teal", "violet", "orange"][i],
      home: "Bedhold",
      household: 10 + i,
      standing: "transient",
    });
  }
  const sealed = brief.validate(
    { scale: "village", name: "Bedhold", places: [{ kind: "gathering", name: "The Lantern" }], cast },
    ctx,
  );
  const w = world.build(31, "cozy-village", sealed);
  const sim = new loadedPF.Sim(w);
  const innId = Object.entries(sealed._ids.zones).find(([, n]) => n === "The Lantern")[0];
  sim.clockMin = 23 * 60;
  sim.resolveSchedules();
  // Guard against a vacuous pass: the bug needs arrivals from another zone. The
  // inn is the whole building — its guest rooms are up the stairs (0.8.0 floors)
  // and a tile clash between two guests is the same clash on either floor.
  const beds = underRoof(w, innId);
  assert.ok(beds.length >= 4, `the inn genuinely fills up at night (${beds.length} NPCs)`);
  const seen = new Map();
  for (const { zone, npc } of beds) {
    const tile = `${zone.id}:${Math.round(npc.x)},${Math.round(npc.y)}`;
    assert.ok(!seen.has(tile), `${npc.name} and ${seen.get(tile)} both bedded down on tile ${tile}`);
    seen.set(tile, npc.name);
  }

  // And the invariant holds for a mixed cast across every daypart — a hash can
  // collide inside a box as small as a household's door apron, so the placer
  // has to treat an occupied tile as closed rather than merely spread by id.
  const kinds = ["host", "guard", "leader", "grower", "maker", "merchant", "folk", "wanderer"];
  const standings = ["resident", "resident", "transient", "transient", "fringe", "destitute"];
  for (let seed = 1; seed <= 12; seed++) {
    const rnd = loadedPF.rng(seed >>> 0);
    const mixed = [];
    for (let i = 0; i < 5 + ((seed * 7) % 6); i++) {
      mixed.push({
        name: `M${i}`,
        role: "villager",
        kind: kinds[(rnd() * kinds.length) | 0],
        tint: "amber",
        home: i % 3 === 0 ? "The Lantern" : "Mixford",
        household: 1 + ((i / 2) | 0),
        standing: standings[(rnd() * standings.length) | 0],
      });
    }
    const mixedSealed = brief.validate(
      {
        scale: "village",
        name: "Mixford",
        places: [
          { kind: "gathering", name: "The Lantern" },
          { kind: "workshop", name: "The Forge" },
        ],
        cast: mixed,
      },
      ctx,
    );
    const mw = world.build(seed, "cozy-village", mixedSealed);
    const msim = new loadedPF.Sim(mw);
    for (const min of [6 * 60, 12 * 60, 19 * 60, 23 * 60]) {
      msim.clockMin = min;
      msim.resolveSchedules();
      for (const zoneId in mw.zones) {
        const tiles = new Map();
        for (const npc of mw.zones[zoneId].npcs) {
          const tile = `${Math.round(npc.x)},${Math.round(npc.y)}`;
          assert.ok(
            !tiles.has(tile),
            `seed ${seed} at ${min / 60}h: ${npc.name} stacked on ${tiles.get(tile)} at ${tile} in ${zoneId}`,
          );
          tiles.set(tile, npc.name);
        }
      }
    }
  }
}

// 14j. A box that OVERFLOWS must not dump the remainder on one tile. The ring
// scan honoured occupancy, but when it exhausted the box the fallback returned
// zone.spawn — a single fixed tile that checks neither occupancy nor standable.
// The suite had no household-at-the-cap fixture, which is exactly where this
// lives: CAPS.household is 6, and a resident's night `home` handle was a 3x2 door
// apron whose door tile standable() excludes, leaving ~3 usable tiles. Three
// members overflowed onto the spawn on EVERY seed tried, and stacked NPCs are
// both un-talkable and frozen — their wander box is the one they failed to fit
// in, so every candidate step fails its bounds test.
//
// 0.8.0: the compiler no longer BUILDS that shape — a household sleeps in a
// dwelling interior, one bed each (case 52). The placer's guarantee outlives the
// fixture that found it, so the pre-0.8.0 handle is forced by hand below rather
// than the case being deleted along with the bug that motivated it.
{
  const cast = [];
  for (let i = 0; i < 6; i++) {
    cast.push({
      name: `Hearth${i}`,
      role: "weaver",
      kind: "maker",
      tint: ["blue", "green", "amber", "rose", "teal", "violet"][i],
      home: "Fullhouse",
      household: 1, // one roof, at the CAPS.household cap
    });
  }
  cast.push({ name: "Lamplight", role: "innkeep", kind: "host", tint: "orange", home: "The Lamp", household: 2 });
  const sealed = brief.validate(
    { scale: "village", name: "Fullhouse", places: [{ kind: "gathering", name: "The Lamp" }], cast },
    ctx,
  );
  // Guard against a vacuous pass: the repair passes must have KEPT one roof.
  const roof = sealed.cast.filter((c) => c.household === sealed.cast[0].household);
  assert.equal(roof.length, 6, `the household survives validation at the cap (${roof.length})`);
  for (const seed of [1, 2, 3, 7, 11]) {
    const w = world.build(seed, "cozy-village", sealed);
    const sim = new loadedPF.Sim(w);

    // ASSERT THE TRIGGER, not just the outcome. A tile scan alone would still
    // pass if schedule compilation stopped putting the household on one
    // undersized box — the overflow path simply would not run, and the case
    // would go quietly green while testing nothing.
    const hearths = [];
    for (const zoneId in w.zones) for (const npc of w.zones[zoneId].npcs) if (npc.name.startsWith("Hearth")) hearths.push(npc);
    assert.equal(hearths.length, 6, `seed ${seed}: the whole household compiles`);
    // Force the pre-0.8.0 shape: the whole household onto the ONE door apron in
    // front of their dwelling. The apron is still real geometry — it is the tile
    // strip the portal into the house sits on — so this is the shipped placer
    // being handed a genuinely undersized shared box, not a synthetic one.
    // A household this size sleeps UPSTAIRS (0.8.0 floors), and the front door
    // opens onto the ground floor — so the apron this case needs is the building's,
    // not the storey's.
    const dwellingId = groundFloorId(hearths[0]._sched.home.zoneId);
    const doorPortal = w.zones.z1.portals.find((p) => p.toZone === dwellingId);
    assert.ok(doorPortal, `seed ${seed}: the household's dwelling opens off the settlement`);
    const apron = {
      x0: Math.max(2, doorPortal.x - 1),
      y0: Math.max(2, doorPortal.y),
      x1: Math.min(w.zones.z1.w - 3, doorPortal.x + 1),
      y1: Math.min(w.zones.z1.h - 3, doorPortal.y + 1),
    };
    for (const npc of hearths) npc._sched.home = { zoneId: "z1", wander: apron };
    const homes = new Set(hearths.map((n) => `${n._sched.home.zoneId}:${JSON.stringify(n._sched.home.wander)}`));
    assert.equal(homes.size, 1, `seed ${seed}: the household shares ONE night home box (${homes.size} distinct)`);
    const home = hearths[0]._sched.home;
    const homeZone = w.zones[home.zoneId];
    let capacity = 0;
    for (let y = home.wander.y0; y <= home.wander.y1; y++) {
      for (let x = home.wander.x0; x <= home.wander.x1; x++) {
        if (loadedPF.schedule.standable(homeZone, x, y)) capacity++;
      }
    }
    assert.ok(capacity < hearths.length, `seed ${seed}: the home box genuinely overflows (${capacity} tiles for 6)`);

    sim.clockMin = 23 * 60; // night: the whole household resolves to one door apron
    sim.resolveSchedules();

    // The handle was actually selected, and the overflow path actually ran.
    let outside = 0;
    for (const npc of hearths) {
      const at = Object.keys(w.zones).find((id) => w.zones[id].npcs.includes(npc));
      assert.equal(at, home.zoneId, `seed ${seed}: ${npc.name} spends the night in its home zone`);
      const b = home.wander;
      if (!(npc.x >= b.x0 && npc.x <= b.x1 && npc.y >= b.y0 && npc.y <= b.y1)) outside++;
    }
    assert.equal(
      outside,
      hearths.length - capacity,
      `seed ${seed}: exactly the overflow stands outside the box (${outside} out, ${capacity} tiles)`,
    );

    for (const zoneId in w.zones) {
      const z = w.zones[zoneId];
      const seen = new Map();
      for (const npc of z.npcs) {
        const x = Math.round(npc.x);
        const y = Math.round(npc.y);
        const tile = `${x},${y}`;
        assert.ok(
          !seen.has(tile),
          `seed ${seed}: ${npc.name} overflowed onto ${seen.get(tile)} at ${tile} in ${zoneId}`,
        );
        seen.set(tile, npc.name);
        // The overflow tile still has to be somewhere an NPC may legally stand.
        assert.ok(loadedPF.schedule.standable(z, x, y), `seed ${seed}: ${npc.name} overflows onto a standable tile`);
      }
    }
  }

  // A SATURATED zone still yields a LEGAL tile. When nothing can satisfy both
  // predicates the placer drops occupancy, never standability: sharing a tile
  // looks wrong, but standing in a wall or a doorway is wrong, and a doorway
  // blocks the way in. The old code returned zone.spawn unchecked.
  //
  // This needs a hand-built zone to be worth anything. Every compiled zone's
  // spawn happens to be standable (480 of 480 tried), so a saturated compiled
  // zone would land on a legal tile by luck and the case would pass against the
  // unchecked return it is meant to catch. Putting the spawn ON a door tile is
  // the one shape that tells the two apart.
  {
    const w = 8;
    const h = 8;
    const fake = {
      w,
      h,
      solid: new Uint8Array(w * h),
      object: new Array(w * h).fill(null),
      portals: [],
      spawn: { x: 3, y: 3 },
    };
    fake.object[3 * w + 3] = "door";
    assert.ok(!loadedPF.schedule.standable(fake, fake.spawn.x, fake.spawn.y), "the fixture's spawn is a doorway");
    const at = loadedPF.schedule.walkableIn(fake, { x0: 2, y0: 2, x1: 4, y1: 4 }, "n1", () => true);
    assert.ok(
      loadedPF.schedule.standable(fake, at.x, at.y),
      `a saturated zone never falls back to an unstandable spawn (${at.x},${at.y})`,
    );
  }

  // And a degenerate box never escapes as a NaN placement. `hash % 0` is NaN and
  // standable()'s bounds test is false for every NaN comparison, so an inverted
  // box would return {x: NaN} as if it were a real tile. Nothing builds one
  // today — this pins the guard, not a live path.
  const z = world.build(5, "cozy-village", sealed).zones.z1;
  for (const box of [
    { x0: 9, y0: 9, x1: 4, y1: 4 }, // inverted on both axes
    { x0: 9, y0: 4, x1: 4, y1: 9 }, // inverted on one
  ]) {
    const at = loadedPF.schedule.walkableIn(z, box, "n1");
    assert.ok(Number.isInteger(at.x) && Number.isInteger(at.y), `an inverted box yields real tiles (${at.x},${at.y})`);
    assert.ok(loadedPF.schedule.standable(z, at.x, at.y), "an inverted box yields a standable tile");
  }
}

// 14k. The floor invariant that lets walkableIn stay TOTAL, enforced instead of
// assumed (review finding). The placer always returns a tile because none of its
// callers has a better answer: a compile-time spawn has to put the cast member
// somewhere, and by the time a cross-zone move needs a tile the NPC has already
// left its old zone. Its last resort is zone.spawn, which is only a legal answer
// while every compiled zone has somewhere legal to stand — so pin that here
// rather than trusting the generator to keep it true. If a future generator can
// emit a zone with no standable tile, this fails first and loudly, and the
// fallback needs a real policy instead of a tile.
{
  let minFree = Infinity;
  let zones = 0;
  for (const theme of ["cozy-village", "sci-fi-colony"]) {
    for (let seed = 1; seed <= 30; seed++) {
      const w = world.build(seed, theme, brief.defaults(theme, seed));
      for (const zoneId in w.zones) {
        const z = w.zones[zoneId];
        zones++;
        assert.ok(
          loadedPF.schedule.standable(z, z.spawn.x, z.spawn.y),
          `${theme} seed ${seed}: ${zoneId} (${z.name}) spawn ${z.spawn.x},${z.spawn.y} is itself standable`,
        );
        let free = 0;
        for (let y = 0; y < z.h; y++) {
          for (let x = 0; x < z.w; x++) if (loadedPF.schedule.standable(z, x, y)) free++;
        }
        assert.ok(free > 0, `${theme} seed ${seed}: ${zoneId} (${z.name}) has somewhere to stand`);
        minFree = Math.min(minFree, free);
      }
    }
  }
  // Guard against a vacuous pass, and pin the headroom the rest of the argument
  // rests on: the cast is capped at 10, so saturating a zone is out of reach too
  // — which is why the branch below the saturation fallback cannot be hit.
  assert.ok(zones > 100, `the sweep actually compiled zones (${zones})`);
  assert.ok(minFree > 10, `every zone has room for a whole cast (smallest ${minFree})`);
}

// 14h. A save whose zone no longer exists lands the player at the start zone's
// SPAWN, not at the old interior coordinates clamped into a much bigger map.
// The solid-tile rescue only fires if those coordinates hit a wall, so without
// this the player silently reappeared in a random corner (design-review find,
// and a guaranteed failure once interiors come and go between versions).
{
  const sealed = brief.defaults("cozy-village", 808);
  const w = world.build(808, "cozy-village", sealed);
  const meta = { pixelforgeBrief: sealed };
  const restore = (savedZone) =>
    loadedPF.save.simFromSaved(
      { v: 1, seed: 808, theme: "cozy-village", zone: savedZone, x: 5 * loadedPF.TILE, y: 4 * loadedPF.TILE, facing: 0 },
      meta,
      "chat-test",
    );

  const gone = restore("zDoesNotExist");
  const spawn = w.zones[w.startZone].spawn;
  assert.equal(gone.zoneId, w.startZone, "an unresolvable zone falls back to the start zone");
  assert.equal(gone.x, (spawn.x + 0.5) * loadedPF.TILE, "and the player lands on the spawn tile, not stale coordinates");
  assert.equal(gone.y, (spawn.y + 0.5) * loadedPF.TILE, "on both axes");

  // A zone that DOES resolve still restores its exact saved position.
  const kept = restore(w.startZone);
  assert.equal(kept.zoneId, w.startZone, "a resolvable zone is honored");
  assert.equal(kept.x, 5 * loadedPF.TILE, "and its saved coordinates survive");
  assert.equal(kept.y, 4 * loadedPF.TILE, "on both axes");
}

// 14f. wait-until is reachable as a player action and lands on the boundary.
{
  const sealed = brief.defaults("cozy-village", 5150);
  const sim = new loadedPF.Sim(world.build(5150, "cozy-village", sealed));
  sim.mode = "walk";
  sim.clockMin = 10 * 60;
  assert.equal(sim.waitUntil("dusk"), true, "waiting for dusk succeeds while walking");
  assert.equal(sim.clockMin, 18 * 60, "the clock lands exactly on the dusk boundary");
  // Waiting for a daypart already past rolls into the next day.
  const dayBefore = sim.day;
  assert.equal(sim.waitUntil("dawn"), true, "waiting for a passed daypart still succeeds");
  assert.equal(sim.day, dayBefore + 1, "and rolls over to the next day");
  assert.equal(sim.clockMin, 5 * 60, "landing on dawn");
}

// The 0.8.0 rooms fixture, shared by 14d and cases 51-53: a settlement with a
// leader's hall, a smith (a shop), a two-person household (two beds under one
// roof), an inn, and a transient who takes a bed in it.
const bedsBrief = (overrides = {}) => ({
  scale: "village",
  name: "Hearthwick",
  places: [{ kind: "gathering", name: "The Kettle" }],
  cast: [
    { name: "Ada", role: "reeve", kind: "leader", tint: "blue", home: "Hearthwick", household: 1 },
    { name: "Ben", role: "smith", kind: "maker", tint: "green", home: "Hearthwick", household: 2 },
    { name: "Cass", role: "cooper", kind: "folk", tint: "amber", home: "Hearthwick", household: 3 },
    { name: "Dell", role: "carter", kind: "folk", tint: "rose", home: "Hearthwick", household: 3 },
    { name: "Perrin", role: "innkeep", kind: "host", tint: "orange", home: "The Kettle", household: 4 },
    { name: "Wisp", kind: "wanderer", tint: "teal", home: "Hearthwick", household: 5, standing: "transient" },
  ],
  ...overrides,
});

// A partition has to show in the TILES, not just in the compiler's bookkeeping.
// An interior shell is wallStone around the edge with one `wall` row at y=1 and
// one door in the south wall — so any `wall` below that row, or any door that is
// not the front door, is a room divider and nothing else can be.
function partitionTiles(z) {
  const walls = [];
  const doors = [];
  for (let y = 2; y < z.h - 1; y++) {
    for (let x = 1; x < z.w - 1; x++) {
      const tile = z.object[z.w * y + x];
      if (tile === "wall") walls.push(`${x},${y}`);
      if (tile === "door") doors.push(`${x},${y}`);
    }
  }
  return { walls, doors };
}

/** Every tile a player can walk to from `start`, four-way, blocked by solids —
 *  and by `closed`, a set of "x,y" the caller wants treated as wall. Closing a
 *  room's door and re-flooding is how a case proves the room really is a ROOM:
 *  enclosed, with that door as its only way in. Loose wall stubs pass every
 *  other check here and fail this one. */
function floodFill(z, start, closed) {
  const seen = new Set([`${start.x},${start.y}`]);
  const queue = [start];
  while (queue.length) {
    const { x, y } = queue.pop();
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= z.w || ny >= z.h) continue;
      if (z.solid[z.w * ny + nx] || seen.has(`${nx},${ny}`) || closed?.has(`${nx},${ny}`)) continue;
      seen.add(`${nx},${ny}`);
      queue.push({ x: nx, y: ny });
    }
  }
  return seen;
}

// 14d. Every compiled zone is reachable from the start zone. An interior place
// that never claimed a building lot used to compile a named, NPC-populated room
// with no portal in either direction — whoever was homed there was stranded and
// un-talkable forever (review finding: 200/200 outposts on the pinned brief).
{
  const sealedOutpost = brief.validate(
    {
      scale: "outpost",
      name: "Stonewatch",
      places: [
        { kind: "gathering", name: "The Kettle" },
        { kind: "hall", name: "The Moot" },
        { kind: "workshop", name: "The Forge" },
      ],
      cast: [
        { name: "Alder", role: "reeve", kind: "leader", tint: "blue", home: "Stonewatch", household: 1 },
        { name: "Perrin", role: "innkeep", kind: "host", tint: "amber", home: "The Kettle", household: 2 },
        { name: "Bram", role: "smith", kind: "maker", tint: "green", home: "The Forge", household: 3 },
        { name: "Sera", role: "elder", kind: "elder", tint: "rose", home: "Stonewatch", household: 4 },
      ],
    },
    ctx,
  );
  // A sanctuary is a named place like any other: the tallest building in the
  // settlement is scenery if the player cannot walk into it, and its keeper is
  // un-talkable if the door never opens.
  const sealedSanctuary = brief.validate(
    {
      scale: "village",
      name: "Bellford",
      places: [
        { kind: "sanctuary", name: "St. Ilde's" },
        { kind: "gathering", name: "The Bell" },
      ],
      cast: [
        { name: "Sera", role: "chaplain", kind: "elder", tint: "rose", home: "St. Ilde's", household: 1 },
        { name: "Perrin", role: "innkeep", kind: "host", tint: "amber", home: "The Bell", household: 2 },
        { name: "Alder", role: "reeve", kind: "leader", tint: "blue", home: "Bellford", household: 3 },
        { name: "Tam", role: "farmer", kind: "grower", tint: "green", home: "Bellford", household: 4 },
      ],
    },
    ctx,
  );
  // 0.8.0 fixture: dwellings and shops compile rooms of their own, so the graph
  // this floods is several times the size it used to be — and a dwelling whose
  // portal pair was forgotten is exactly the "room with no door" this case
  // exists to refuse.
  const sealedRooms = brief.validate(bedsBrief(), ctx);
  // The outpost fixture exists to prove the DROP guard, so it demands no zone by
  // name; the sanctuary fixture would pass trivially if its church were one of
  // the dropped ones, so that one names what has to be there.
  for (const [sealed, required, minRooms] of [
    [sealedOutpost, [], 0],
    [sealedSanctuary, ["St. Ilde's", "The Bell"], 2],
    // Three interior rooms, not four: the smith's household lives over the shop,
    // so "Ben's home" is the shop and no second roof is minted for him.
    [sealedRooms, ["The Kettle", "Ben's shop", "Cass's home"], 3],
  ]) {
    for (const seed of [1, 2, 3, 4, 5]) {
      const w = world.build(seed, "cozy-village", sealed);
      // Non-vacuous: the sweep below is only interesting if the build actually
      // produced the interior rooms whose doors it is checking.
      const rooms = Object.values(w.zones).filter((zone) => zone.mapExport === false);
      assert.ok(rooms.length >= minRooms, `seed ${seed}: ${rooms.length} interior rooms compiled (want ${minRooms})`);
      // Flood the portal graph from the start zone.
      const reached = new Set([w.startZone]);
      const queue = [w.startZone];
      while (queue.length) {
        for (const portal of w.zones[queue.pop()].portals) {
          if (!reached.has(portal.toZone)) {
            reached.add(portal.toZone);
            queue.push(portal.toZone);
          }
        }
      }
      for (const zoneId in w.zones) {
        assert.ok(reached.has(zoneId), `seed ${seed}: zone ${zoneId} (${w.zones[zoneId].name}) is reachable`);
      }
      // And nobody can be SENT somewhere stranded either. Re-asserting
      // reached.has(zoneId) per NPC only repeats the sweep above; what the zone
      // sweep cannot see is a baked schedule handle pointing at an interior this
      // build no longer compiles (the drop guard in 20-world), which would move
      // an NPC out of the world on the next daypart — or into a room with no door.
      for (const zoneId in w.zones) {
        for (const npc of w.zones[zoneId].npcs) {
          for (const name of ["post", "home", "public"]) {
            const handle = npc._sched[name];
            if (!handle) continue;
            assert.ok(w.zones[handle.zoneId], `seed ${seed}: ${npc.name}'s ${name} handle names a live zone`);
            assert.ok(reached.has(handle.zoneId), `seed ${seed}: ${npc.name}'s ${name} handle is reachable`);
          }
        }
      }
      for (const name of required) {
        assert.ok(
          Object.values(w.zones).some((zone) => zone.name === name),
          `seed ${seed}: ${name} compiled`,
        );
      }
    }
  }
}

// 14l. The vista cutscene beat. It exists to exercise the host's transient
// narration-collapse request (capability API 1.13): the package asks only while
// the beat runs. The contract that matters is that it always STOPS asking —
// on its own timer, and immediately if the player walks away.
{
  const sealed = brief.defaults("cozy-village", 4242);
  const w = world.build(4242, "cozy-village", sealed);
  const sim = new loadedPF.Sim(w);
  sim.mode = "walk";
  const z = sim.zone();

  // Standing anywhere else, nothing is ever requested.
  sim.x = 20 * loadedPF.TILE;
  sim.y = 20 * loadedPF.TILE;
  sim.step(1 / 60, {});
  assert.equal(sim.cutscene, null, "no beat away from the corner");

  // Stepping into the corner starts it.
  sim.x = 2 * loadedPF.TILE;
  sim.y = 2 * loadedPF.TILE;
  sim.step(1 / 60, {});
  assert.ok(sim.cutscene, "the corner starts a beat");
  assert.ok(sim.cutscene.text.includes(z.name), "the caption names the settlement");

  // It ends on its own, without the player doing anything.
  for (let i = 0; i < 60 * 10; i++) sim.step(1 / 60, {});
  assert.equal(sim.cutscene, null, "the beat releases itself on its timer");

  // Loitering does not loop it — it re-arms only after leaving.
  for (let i = 0; i < 60 * 10; i++) sim.step(1 / 60, {});
  assert.equal(sim.cutscene, null, "loitering in the corner does not retrigger");
  sim.x = 20 * loadedPF.TILE;
  sim.y = 20 * loadedPF.TILE;
  sim.step(1 / 60, {});
  sim.x = 2 * loadedPF.TILE;
  sim.y = 2 * loadedPF.TILE;
  sim.step(1 / 60, {});
  assert.ok(sim.cutscene, "leaving and returning arms it again");

  // Walking away releases it immediately — a beat can never hold the box hostage.
  sim.x = 20 * loadedPF.TILE;
  sim.y = 20 * loadedPF.TILE;
  sim.step(1 / 60, {});
  assert.equal(sim.cutscene, null, "walking away releases the beat at once");

  // And it never survives the screen changing hands. A beat is walk-only, so a
  // player who opens the message box (dialogue) or is pulled into combat while
  // standing in the corner would otherwise leave the request standing over the
  // whole of it — asking the host to fold away the very narration they switched
  // modes to read, with the timer frozen so it could not even time out. Replay is
  // the third case and is cut at core.setMode: it returns before sim.step() runs.
  for (const mode of ["dialogue", "combat"]) {
    sim.x = 20 * loadedPF.TILE; sim.y = 20 * loadedPF.TILE; sim.step(1 / 60, {});
    sim.x = 2 * loadedPF.TILE; sim.y = 2 * loadedPF.TILE; sim.step(1 / 60, {});
    assert.ok(sim.cutscene, `the corner starts a beat before ${mode}`);
    sim.mode = mode;
    sim.step(1 / 60, {});
    assert.equal(sim.cutscene, null, `a beat does not survive ${mode}`);
    sim.mode = "walk";
  }
}

// 14m. The chrome memo across a change of hands. setMode drops the beat when the
// screen changes owner (14l), but the frame loop asks for chrome again only when
// the beat state DIFFERS from the memo of what was last asked for. So dropping a
// beat has to move that memo too: left saying "cutscene" while that same setMode
// declared otherwise, the NEXT beat matches the stale memo, the diff never fires,
// and the host is never asked to collapse narration for it. 90-element is a DOM
// module the bundle above leaves out, so it is evaluated here on its own against
// the two globals it touches at load time.
{
  globalThis.HTMLElement ??= class {};
  globalThis.customElements ??= { get: () => undefined, define: () => {} };
  new Function("PF", `"use strict";\n${readFileSync(join(here, "src", "90-element.js"), "utf8")}`)(loadedPF);

  const core = loadedPF.core;
  const asked = [];
  core.host = { setExperienceChrome: (c) => asked.push(!!c?.requestsCollapsedNarration) };
  core.sim = { mode: "walk", cutscene: null };
  core.input = {};
  core.hud = null;
  core._cutsceneDeclared = false;
  // The frame loop's own diff, which is the thing the memo exists to serve.
  const frame = () => {
    if (!!core.sim.cutscene !== core._cutsceneDeclared) {
      core._cutsceneDeclared = !!core.sim.cutscene;
      core._declareChrome();
    }
  };

  core.sim.cutscene = { text: "the valley opens up" };
  frame();
  assert.equal(asked.at(-1), true, "the first beat asks the host to collapse narration");

  core.setMode("replay");
  assert.equal(core.sim.cutscene, null, "the beat does not survive replay");
  assert.equal(asked.at(-1), false, "and the ask is withdrawn with it");
  assert.equal(core._cutsceneDeclared, false, "the memo tracks the withdrawal, not the dropped beat");

  core.setMode("walk");
  core.sim.cutscene = { text: "the valley again, later" };
  frame();
  assert.equal(asked.at(-1), true, "a later beat is declared once the screen comes back");
}

// ── The sanctuary (0.8.0): a tall facade outside, a room worth entering inside ──
// A church is the first place kind whose exterior is not a house wearing a
// different roof: building()'s facade option turns its already-solid body rows
// into visible stonework, and the compiler spends whatever head-room the lot has
// on more of the same.
const sanctuaryBrief = (overrides = {}) => ({
  scale: "village",
  name: "Bellford",
  places: [
    { kind: "sanctuary", name: "St. Ilde's", flavor: "Cold stone, warm candles." },
    { kind: "gathering", name: "The Bell" },
  ],
  cast: [
    { name: "Sera", role: "chaplain", kind: "elder", tint: "rose", home: "St. Ilde's", household: 1 },
    { name: "Perrin", role: "innkeep", kind: "host", tint: "amber", home: "The Bell", household: 2 },
    { name: "Alder", role: "reeve", kind: "leader", tint: "blue", home: "Bellford", household: 3 },
    { name: "Tam", role: "farmer", kind: "grower", tint: "green", home: "Bellford", household: 4 },
  ],
  ...overrides,
});
const zoneNamed = (w, name) => Object.values(w.zones).find((zone) => zone.name === name);

// 46. The interior is a nave, not a room with a label: an altar the aisle walks
// up to, benches in rows either side, candles at the altar, and a carpet the
// player can follow from the door without squeezing past the furniture.
{
  const sealed = brief.validate(sanctuaryBrief(), ctx);
  const w = world.build(424242, "cozy-village", sealed);
  checkWorld(w, sealed, "sanctuary");
  const z = zoneNamed(w, "St. Ilde's");
  assert.ok(z, "the sanctuary compiled");
  assert.equal(z.mapKind, "building", "a church is a building on the map");
  const at = (x, y) => z.object[z.w * y + x];
  const solidAt = (x, y) => z.solid[z.w * y + x];

  // The altar: a run of at least three tiles, every one of them solid. The rug
  // aisle is painted FIRST for exactly this reason — a ground fill clears
  // solidity, so reversing the order would leave a walk-through altar (the
  // hall's shipped bug, and the reason its comment exists).
  const altars = [];
  for (let y = 0; y < z.h; y++) for (let x = 0; x < z.w; x++) if (at(x, y) === "altar") altars.push({ x, y });
  assert.ok(altars.length >= 3, `the altar is a real focal block (${altars.length} tiles)`);
  assert.equal(new Set(altars.map((tile) => tile.y)).size, 1, "the altar is one run, not scattered furniture");
  for (const tile of altars) assert.equal(solidAt(tile.x, tile.y), 1, "the altar blocks — the aisle stops at it");

  // Pews: at least three rows, on BOTH sides of the aisle.
  const benchRows = [];
  for (let y = 0; y < z.h; y++) {
    const row = [];
    for (let x = 0; x < z.w; x++) if (at(x, y) === "counter") row.push(x);
    if (row.length) benchRows.push({ y, xs: row });
  }
  assert.ok(benchRows.length >= 3, `pews in rows (${benchRows.length} rows)`);
  const aisleX = (z.w / 2) | 0;
  for (const row of benchRows) {
    assert.ok(
      row.xs.some((x) => x < aisleX),
      `row ${row.y} seats the left of the aisle`,
    );
    assert.ok(
      row.xs.some((x) => x > aisleX),
      `row ${row.y} seats the right of the aisle`,
    );
    assert.ok(!row.xs.includes(aisleX), `row ${row.y} leaves the aisle open`);
  }

  // Candles: the altar row is lit from both sides, so the room reads at night.
  const altarY = altars[0].y;
  const altarLights = z.lights.filter((light) => light.y === altarY);
  assert.ok(altarLights.length >= 2, "the altar is lit from both sides");
  assert.ok(
    altarLights.some((light) => light.x < aisleX) && altarLights.some((light) => light.x > aisleX),
    "a candle each side, not two on one",
  );

  // And the walk itself: from the spawn inside the door, up the carpet, to the
  // tile below the altar. A pew row closing over the aisle would pass every
  // assertion above and still make the room pointless.
  const seen = new Set([`${z.spawn.x},${z.spawn.y}`]);
  const queue = [z.spawn];
  while (queue.length) {
    const { x, y } = queue.pop();
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ]) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= z.w || ny >= z.h || solidAt(nx, ny) || seen.has(`${nx},${ny}`)) continue;
      seen.add(`${nx},${ny}`);
      queue.push({ x: nx, y: ny });
    }
  }
  assert.ok(seen.has(`${aisleX},${altarY + 1}`), "the aisle reaches the altar rail from the door");
  assert.equal(z.ground[z.w * (altarY + 1) + aisleX], "rug", "and the walk up is carpeted");
  // Non-vacuous: the altar is the sanctuary's own furniture, not something every
  // interior gained.
  assert.ok(!zoneNamed(w, "The Bell").object.includes("altar"), "the gathering interior grew no altar");
}

// 47. The exterior is TALLER, on tiles rather than on vibes: a sanctuary shows
// rows of bare wall where an ordinary building shows only roof, and it spends
// the lot's head-room going UP — clamped so it never reaches the border ring
// above the top row of lots, and never roofs the crossroad below the bottom one.
{
  // Facade tiles: solid wall standing in the open, with no roof over it. Roofed
  // body rows and the eave both carry overhead, so this counts exactly the rows
  // the facade option exposes.
  const facadeTiles = (v, x0, x1) => {
    let count = 0;
    for (let y = 0; y < v.h; y++) {
      for (let x = Math.max(0, x0); x <= Math.min(v.w - 1, x1); x++) {
        const i = v.w * y + x;
        if (v.object[i] === "wallStone" && !v.overhead[i] && v.ground[i] === "stone") count++;
      }
    }
    return count;
  };
  // The topmost row this lot paints anything on — the eave, two rows above the
  // footprint's top.
  const topRow = (v, doorX, doorY) => {
    let top = doorY;
    while (top > 0 && (v.object[v.w * (top - 1) + doorX] || v.overhead[v.w * (top - 1) + doorX])) top--;
    return top;
  };
  // The same lot, built as a church and as an ordinary interior facade: same
  // brief, same slot, so every difference measured below is the facade option's.
  const lotOf = (sealed, seed, kind) => {
    const swapped = {
      ...sealed,
      places: sealed.places.map((place) => (place.kind === "sanctuary" ? { ...place, kind } : place)),
    };
    const w = world.build(seed, "cozy-village", swapped);
    const v = w.zones.z1;
    const z = zoneNamed(w, "St. Ilde's");
    const portal = z ? v.portals.find((p) => p.toZone === z.id) : null;
    if (!portal) return null;
    return {
      doorY: portal.y,
      top: topRow(v, portal.x, portal.y),
      facade: facadeTiles(v, portal.x - 3, portal.x + 4),
      midY: (v.h / 2) | 0,
    };
  };

  let sawRise = false;
  for (const scale of ["outpost", "hamlet", "village", "town"]) {
    // Padding pushes the church down the lot list, so both rows of lots — the one
    // under the border ring and the one under the crossroad — get exercised.
    for (const pad of [0, 1, 2, 3]) {
      const places = ["gathering", "workshop", "hall"]
        .slice(0, pad)
        .map((kind, index) => ({ kind, name: `Pad ${index}` }));
      places.push({ kind: "sanctuary", name: "St. Ilde's" });
      const sealed = brief.validate(sanctuaryBrief({ scale, places }), ctx);
      const church = lotOf(sealed, 7, "sanctuary");
      const plain = lotOf(sealed, 7, "workshop");
      if (!church || !plain) continue; // the lots ran dry — the drop guard's case
      const label = `${scale}/pad${pad}`;

      assert.ok(church.facade >= 2, `${label}: the church shows bare wall (${church.facade} tiles)`);
      assert.equal(plain.facade, 0, `${label}: an ordinary building shows none — it is all roof`);
      assert.equal(church.doorY, plain.doorY, `${label}: the door stays on the row the lot puts it on`);
      assert.ok(church.top <= plain.top, `${label}: the church never sits lower than an ordinary building`);
      assert.ok(church.top >= 2, `${label}: the eave stays clear of the border ring (top row ${church.top})`);
      // The clamp only has to protect a lot that was clear to begin with: an
      // outpost's lower row already eaves over its crossroad with any building.
      if (plain.doorY > church.midY && plain.top > church.midY) {
        assert.ok(church.top > church.midY, `${label}: the extra height never roofs the crossroad`);
      }
      if (church.top < plain.top) {
        sawRise = true;
        // The height went into the facade, not the roof: every row won is a row
        // of visible wall, so the roofline stays as deep as anyone else's.
        assert.ok(church.facade >= plain.facade + 2, `${label}: every row it wins is a row of wall`);
      }
    }
  }
  assert.ok(sawRise, "at least one lot had the head-room to build up — the clamp is not simply always zero");
}

// 48. A brief sealed before 0.8.0 compiles to exactly the tiles it always did.
// The elder → sanctuary wiring is the risk: it has to stay dormant when the
// brief names no church, or every existing world would quietly rearrange itself
// on the next load (worlds are rebuilt from seed + brief, never from tiles).
{
  const older = {
    scale: "village",
    name: "Mossbrook",
    places: [
      { kind: "gathering", name: "The Wet Boot" },
      { kind: "wilds", name: "The Fallow" },
    ],
    features: [{ tag: "crop-plots", name: "The Rows" }],
    cast: [
      { name: "Sera", role: "weaver", kind: "elder", tint: "rose", home: "Mossbrook", household: 1 },
      { name: "Perrin", role: "innkeep", kind: "host", tint: "amber", home: "The Wet Boot", household: 2 },
      { name: "Alder", role: "mayor", kind: "leader", tint: "blue", home: "Mossbrook", household: 3 },
      { name: "Tam", role: "farmer", kind: "grower", tint: "green", home: "Mossbrook", household: 4 },
      { name: "Brin", role: "carter", kind: "folk", tint: "teal", home: "Mossbrook", household: 5 },
    ],
  };
  const sealed = brief.validate(older, ctx);
  assert.ok(
    sealed.cast.some((member) => member.kind === "elder"),
    "the fixture really does carry an elder — the dormancy claim needs one",
  );
  const tiles = (w) =>
    JSON.stringify(
      Object.keys(w.zones).map((id) => {
        const z = w.zones[id];
        return [id, z.w, z.h, z.ground, z.object, z.overhead, [...z.solid], z.portals, z.lights, z.spawn];
      }),
    );
  // The same brief with the elder demoted to plain folk: identical tiles is what
  // "dormant" MEANS. A lot it claimed, or a dwelling slot it displaced, shows up
  // here as a diff.
  const demoted = brief.validate(
    { ...older, cast: older.cast.map((member) => (member.kind === "elder" ? { ...member, kind: "folk" } : member)) },
    ctx,
  );
  for (const seed of [1, 7, 424242]) {
    const w = world.build(seed, "cozy-village", sealed);
    checkWorld(w, sealed, `older-brief seed ${seed}`);
    assert.equal(tiles(w), tiles(world.build(seed, "cozy-village", demoted)), `seed ${seed}: an elder mints nothing`);
    for (const id in w.zones) {
      const z = w.zones[id];
      assert.ok(!z.object.includes("altar"), `seed ${seed}: no altar anywhere in ${id}`);
      // Facade rows are the other half of the new machinery, and equally opt-in.
      for (let i = 0; i < z.object.length; i++) {
        if (z.object[i] !== "wallStone" || z.overhead[i] || z.ground[i] !== "stone") continue;
        assert.fail(`seed ${seed}: ${id} grew a facade row at ${i % z.w},${(i / z.w) | 0}`);
      }
    }
  }
}

// 49. The church world holds every NPC invariant the settlement does, around the
// clock: nobody stands in a wall, a doorway or a portal tile, and nobody shares
// a tile — including inside the sanctuary, whose keeper is the one cast member
// the schedule table now posts there all day.
{
  const sealed = brief.validate(sanctuaryBrief(), ctx);
  for (const seed of [1, 7, 424242]) {
    const w = world.build(seed, "cozy-village", sealed);
    const sim = new loadedPF.Sim(w);
    for (const min of [6 * 60, 12 * 60, 19 * 60, 23 * 60]) {
      sim.clockMin = min;
      sim.resolveSchedules();
      for (const zoneId in w.zones) {
        const z = w.zones[zoneId];
        const taken = new Set();
        for (const npc of z.npcs) {
          const x = Math.round(npc.x);
          const y = Math.round(npc.y);
          assert.ok(
            loadedPF.schedule.standable(z, x, y),
            `seed ${seed} @${min}: ${npc.name} stands somewhere legal in ${zoneId}`,
          );
          assert.ok(!taken.has(`${x},${y}`), `seed ${seed} @${min}: ${npc.name} shares nobody's tile`);
          taken.add(`${x},${y}`);
        }
      }
    }
    // Non-vacuous: the keeper really is in the church at the hour a player is
    // most likely to open its door.
    sim.clockMin = 12 * 60;
    sim.resolveSchedules();
    assert.ok(
      zoneNamed(w, "St. Ilde's").npcs.some((npc) => npc.name === "Sera"),
      `seed ${seed}: the chaplain keeps the sanctuary through the day`,
    );
  }
}

// 50. The keeper schedule tier is scoped to elders who actually hold a sanctuary.
// Adding a church must not change how elders behave in the settlements that have
// none — those still keep the plaza habits they have always had.
{
  const cast = (elderHome) => [
    { name: "Ana", role: "reeve", kind: "leader", tint: "blue", home: "Oldtown", household: 1 },
    { name: "Gran", role: "chaplain", kind: "elder", tint: "rose", home: elderHome, household: 2 },
    { name: "Bo", role: "farmer", kind: "folk", tint: "green", home: "Oldtown", household: 3 },
    { name: "Cy", role: "cooper", kind: "folk", tint: "amber", home: "Oldtown", household: 4 },
  ];
  const noChurch = brief.validate({ scale: "village", name: "Oldtown", cast: cast("Oldtown") }, ctx);
  const withChurch = brief.validate(
    { scale: "village", name: "Oldtown", places: [{ kind: "sanctuary", name: "St Ives" }], cast: cast("St Ives") },
    ctx,
  );
  const midday = (sealed) => {
    const w = world.build(5, "cozy-village", sealed);
    const sim = new loadedPF.Sim(w);
    sim.clockMin = 12 * 60;
    sim.resolveSchedules();
    for (const id in w.zones) {
      const npc = w.zones[id].npcs.find((n) => n.name === "Gran");
      if (npc) return { world: w, zoneId: id, npc };
    }
    throw new Error("the elder vanished");
  };

  // Without a sanctuary: no keeper flag, and the plaza by day exactly as before.
  const plain = midday(noChurch);
  assert.equal(plain.npc._sched.keeper, false, "an elder with no sanctuary is not a keeper");
  assert.equal(plain.zoneId, "z1", "and stays in the settlement");
  const v = plain.world.zones.z1;
  const mx = (v.w / 2) | 0;
  const my = (v.h / 2) | 0;
  assert.ok(
    Math.abs(Math.round(plain.npc.x) - mx) <= 6 && Math.abs(Math.round(plain.npc.y) - my) <= 5,
    "an elder with no sanctuary still spends midday in the plaza",
  );

  // Holding one: keeper, and inside it rather than out in the square.
  const keeping = midday(withChurch);
  assert.equal(keeping.npc._sched.keeper, true, "an elder homed at a sanctuary keeps it");
  assert.equal(keeping.world.zones[keeping.zoneId].name, "St Ives", "and is inside it at midday");
}

// ── Dwellings, shops and beds (0.8.0): the rooms behind the doors ────────────
// The complaint this answers: NPCs were scheduled somewhere to rest and the
// player never saw it, because a dwelling was a facade with no room behind it —
// "turned in for the night" resolved to a box on the door apron OUTSIDE.

// 51. A resident spends the night in their dwelling, ON their own bed, and is
// back out in the settlement by day. The transient's inn bed is the same
// promise for someone with no roof of their own.
{
  const sealed = brief.validate(bedsBrief(), ctx);
  const findNpc = (w, name) => {
    for (const id in w.zones) {
      const npc = w.zones[id].npcs.find((n) => n.name === name);
      if (npc) return { id, npc, zone: w.zones[id] };
    }
    return null;
  };
  for (const seed of [1, 7, 31, 424242]) {
    const w = world.build(seed, "cozy-village", sealed);
    checkWorld(w, sealed, `beds seed ${seed}`);
    const sim = new loadedPF.Sim(w);

    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    const night = findNpc(w, "Cass");
    assert.notEqual(night.id, "z1", `seed ${seed}: Cass is indoors at night, not on the street`);
    assert.equal(night.zone.mapKind, "building", `seed ${seed}: and the room is a building interior`);
    assert.equal(
      night.zone.object[night.zone.w * night.npc.y + night.npc.x],
      "bed",
      `seed ${seed}: Cass stands on a bed at 23:00 (${night.npc.x},${night.npc.y} in ${night.id})`,
    );
    // The handle really is a bed, not a box that happens to overlap one.
    const handle = night.npc._sched.home;
    assert.equal(handle.zoneId, night.id, `seed ${seed}: the night handle names the dwelling`);
    assert.equal(handle.spread, false, `seed ${seed}: a bed is a placement, never a box to disperse in`);
    assert.ok(
      handle.wander.x0 === handle.wander.x1 && handle.wander.y0 === handle.wander.y1,
      `seed ${seed}: the night handle is one tile wide`,
    );

    // The transient takes a real bed at the inn rather than standing among the
    // tables — and the inn keeps its guest rooms UPSTAIRS (0.8.0 floors), so the
    // bed is a floor above the tap room and the walk there is a stair portal.
    const guest = findNpc(w, "Wisp");
    assert.equal(
      guest.zone.name,
      "The Kettle, upstairs",
      `seed ${seed}: the drifter beds down in the inn's guest rooms`,
    );
    assert.equal(guest.zone.mapExport, false, `seed ${seed}: and a guest storey is never a map destination`);
    assert.equal(
      guest.zone.object[guest.zone.w * guest.npc.y + guest.npc.x],
      "bed",
      `seed ${seed}: and in one of its guest beds`,
    );

    sim.clockMin = 12 * 60;
    sim.resolveSchedules();
    const day = findNpc(w, "Cass");
    assert.equal(day.id, "z1", `seed ${seed}: Cass is back out in the settlement by day`);
    assert.equal(
      w.zones.z1.object[w.zones.z1.w * day.npc.y + day.npc.x],
      null,
      `seed ${seed}: and standing on open ground, not furniture`,
    );
  }
}

// 52. Every resident under one roof gets their OWN SLEEPING TILE. Six is
// CAPS.household, the largest a single household ever has to sleep — and two
// sprites on one tile makes the lower one un-talkable, so "a place each" is an
// invariant rather than a nicety. Six fills both bedrooms to their bunks, which
// is exactly why the tile assertion names bed AND bunk: a bunk is a sleeping
// place, and the invariant under test is one tile per sleeper, not which
// furniture it is.
// (The pre-0.8.0 shape put the whole household on one door apron; case 14j
// keeps that overflow path under test by forcing the old handle by hand.)
{
  const cast = [];
  for (let i = 0; i < 6; i++) {
    cast.push({
      name: `Kin${i}`,
      role: "weaver",
      kind: "folk",
      tint: ["blue", "green", "amber", "rose", "teal", "violet"][i],
      home: "Sixfold",
      household: 1,
    });
  }
  cast.push({ name: "Lamp", role: "innkeep", kind: "host", tint: "orange", home: "The Lamp", household: 2 });
  const sealed = brief.validate(
    { scale: "village", name: "Sixfold", places: [{ kind: "gathering", name: "The Lamp" }], cast },
    ctx,
  );
  assert.equal(
    sealed.cast.filter((c) => c.household === sealed.cast[0].household).length,
    6,
    "the household survives validation at the cap — a split would make this vacuous",
  );
  for (const seed of [1, 3, 11]) {
    const w = world.build(seed, "cozy-village", sealed);
    const kin = [];
    for (const id in w.zones) for (const npc of w.zones[id].npcs) if (npc.name.startsWith("Kin")) kin.push(npc);
    assert.equal(kin.length, 6, `seed ${seed}: the whole household compiles`);
    const zoneIds = new Set(kin.map((n) => n._sched.home.zoneId));
    assert.equal(zoneIds.size, 1, `seed ${seed}: one household, one roof (${[...zoneIds].join(",")})`);
    const homeZone = w.zones[[...zoneIds][0]];
    const tiles = new Set(kin.map((n) => `${n._sched.home.wander.x0},${n._sched.home.wander.y0}`));
    assert.equal(tiles.size, 6, `seed ${seed}: six sleepers, six places (${tiles.size} distinct)`);
    for (const tile of tiles) {
      const [x, y] = tile.split(",").map(Number);
      assert.ok(
        SLEEPS_ON.has(homeZone.object[homeZone.w * y + x]),
        `seed ${seed}: ${tile} is an actual sleeping tile (${homeZone.object[homeZone.w * y + x]})`,
      );
    }

    // And it holds once the Sim has placed them: same room, one tile each.
    const sim = new loadedPF.Sim(w);
    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    const taken = new Set();
    for (const npc of kin) {
      assert.ok(homeZone.npcs.includes(npc), `seed ${seed}: ${npc.name} sleeps at home`);
      const tile = `${npc.x},${npc.y}`;
      assert.ok(!taken.has(tile), `seed ${seed}: ${npc.name} shares tile ${tile} with a housemate`);
      taken.add(tile);
      assert.ok(SLEEPS_ON.has(homeZone.object[homeZone.w * npc.y + npc.x]), `seed ${seed}: ${npc.name} is in a bed`);
    }
  }
}

// 53. A shop opens, and it is not an empty room: a counter to be served over,
// stock behind it, and the owner working there through the day. The maintainer
// call was that an empty shop reads worse than a locked door, so the room ships
// furnished and staffed in the same change.
{
  const sealed = brief.validate(bedsBrief(), ctx);
  for (const seed of [1, 31, 424242]) {
    const w = world.build(seed, "cozy-village", sealed);
    const shop = Object.values(w.zones).find((zone) => zone.name === "Ben's shop");
    assert.ok(shop, `seed ${seed}: the smith's shop compiled a room`);
    assert.equal(shop.mapExport, false, `seed ${seed}: a shop is a room inside a building, not a destination`);
    assert.ok(shop.object.includes("counter"), `seed ${seed}: there is a counter`);
    const stock = shop.object.filter((tile) => tile === "shelf").length;
    assert.ok(stock >= 3, `seed ${seed}: and stock behind it (${stock} tiles)`);
    // Non-vacuous the other way: stock is the shop's own furniture, not something
    // every interior grew. A CELLAR is the one other room shelving belongs in —
    // stores are what a cellar IS — so it is named here rather than waved through.
    for (const zone of Object.values(w.zones)) {
      if (zone === shop || !zone.object.includes("shelf")) continue;
      assert.ok(zone.id.endsWith("b"), `seed ${seed}: ${zone.name} sprouted shelving and is not a cellar`);
    }

    const sim = new loadedPF.Sim(w);
    sim.clockMin = 12 * 60;
    sim.resolveSchedules();
    const ben = shop.npcs.find((npc) => npc.name === "Ben");
    assert.ok(ben, `seed ${seed}: the owner is inside their own shop at midday`);
    assert.equal(
      shop.object[shop.w * (ben.y + 1) + ben.x],
      "counter",
      `seed ${seed}: standing behind the counter, not out in front of it`,
    );

    // The counter must not wall the shopkeeper off: a pocket the player cannot
    // walk into would strand the very person the room exists to show. Flood the
    // room from the tile inside its door.
    const seen = new Set([`${shop.spawn.x},${shop.spawn.y}`]);
    const queue = [shop.spawn];
    while (queue.length) {
      const { x, y } = queue.pop();
      for (const [dx, dy] of [
        [0, -1],
        [0, 1],
        [-1, 0],
        [1, 0],
      ]) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= shop.w || ny >= shop.h) continue;
        if (shop.solid[shop.w * ny + nx] || seen.has(`${nx},${ny}`)) continue;
        seen.add(`${nx},${ny}`);
        queue.push({ x: nx, y: ny });
      }
    }
    assert.ok(seen.has(`${ben.x},${ben.y}`), `seed ${seed}: the player can reach the shopkeeper from the door`);

    // Off duty he goes to bed — and the bed is UPSTAIRS, in the same building.
    // A shop is a live-work premises: the trade is carried on where the family
    // lives, so the smith sleeps over the forge rather than in a second house
    // that used to cost the settlement a whole second lot.
    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    const home = Object.values(w.zones).find((zone) => zone.npcs.some((npc) => npc.name === "Ben"));
    assert.equal(home, shop, `seed ${seed}: the smith sleeps in the shop he works`);
    const asleep = home.npcs.find((npc) => npc.name === "Ben");
    assert.ok(
      SLEEPS_ON.has(home.object[home.w * asleep.y + asleep.x]),
      `seed ${seed}: a shop owner sleeps in their own bed, behind the shop floor`,
    );
    assert.ok(
      !Object.values(w.zones).some((zone) => zone.name === "Ben's home"),
      `seed ${seed}: and no second roof is minted for the same household`,
    );
  }
}

// ── Rooms, bedrooms and bunks (0.8.0) ────────────────────────────────────────
// The complaint this answers: every bed in a dwelling sat in ONE open room, laid
// along two rows in the same 14x10 space as the table, so a six-person household
// read as a dormitory whether or not it was one — and the inn's guest beds were
// four tiles in the corner of the common room rather than rooms with doors.

/** A settlement whose only household is `size` people of one cast kind, plus the
 *  fixed pair (a reeve and an innkeep) that keeps the lot arithmetic identical
 *  between two calls that differ ONLY in `kind`. */
const houseBrief = (name, size, kind) => ({
  scale: "village",
  name,
  places: [{ kind: "gathering", name: `The ${name} Lamp` }],
  cast: [
    ...Array.from({ length: size }, (_, i) => ({
      name: `Kin${i}`,
      role: "ward",
      kind,
      tint: ["blue", "green", "amber", "rose", "teal", "violet"][i % 6],
      home: name,
      household: 1,
    })),
    { name: "Ada", role: "reeve", kind: "leader", tint: "grey", home: name, household: 2 },
    { name: "Perrin", role: "innkeep", kind: "host", tint: "orange", home: `The ${name} Lamp`, household: 3 },
  ],
});
const findZone = (w, name) => Object.values(w.zones).find((zone) => zone.name === name);

/** A village whose every lot is spoken for — three named places, a live-work
 *  farm and a duty-station post — so the compiler's over-subscription merge folds
 *  every household still owed a roof onto the ONE dwelling slot left. `hands`
 *  sets how many bodies end up under it: the only way to put more than
 *  CAPS.household of them there, which is exactly the shape a dormitory is for.
 *
 *  The trades are deliberately the ones that do NOT take their household with
 *  them: the reeve and the innkeep hold named places, the merchant's shop binds
 *  to the named workshop, and the watch keeps a post nobody lives in — so only
 *  the farmer leaves the merged block. */
const bunkhouseBrief = (hands) => ({
  scale: "village",
  name: "Cramp",
  places: [
    { kind: "gathering", name: "The Kettle" },
    { kind: "hall", name: "The Moot" },
    { kind: "workshop", name: "The Forge" },
  ],
  cast: [
    { name: "Ada", role: "reeve", kind: "leader", tint: "blue", home: "Cramp", household: 1 },
    { name: "Perrin", role: "innkeep", kind: "host", tint: "orange", home: "Cramp", household: 2 },
    { name: "Tam", role: "farmer", kind: "grower", tint: "green", home: "Cramp", household: 3 },
    { name: "Gil", role: "warden", kind: "guard", tint: "grey", home: "Cramp", household: 4 },
    { name: "Ben", role: "trader", kind: "merchant", tint: "amber", home: "Cramp", household: 5 },
    ...Array.from({ length: hands }, (_, i) => ({
      name: `Kin${i}`,
      role: "hand",
      kind: "folk",
      tint: ["rose", "teal", "violet", "red", "blue"][i % 5],
      home: "Cramp",
      household: 6,
    })),
  ],
});

// 54. A small household sleeps behind a bedroom DOOR, and both sleepers are
// inside that room at night on tiles of their own. The partition is asserted in
// the TILES — a wall run below the shell's own wall row with a door in it —
// because a room that exists only in the compiler's bookkeeping is not a room.
{
  const sealed = brief.validate(bedsBrief(), ctx);
  for (const seed of [1, 3, 11, 424242]) {
    const w = world.build(seed, "cozy-village", sealed);
    checkWorld(w, sealed, `bedrooms seed ${seed}`);
    const home = findZone(w, "Cass's home");
    assert.ok(home, `seed ${seed}: the two-person household compiled a dwelling`);
    const { walls, doors } = partitionTiles(home);
    assert.ok(walls.length > 0, `seed ${seed}: the dwelling has an interior wall run`);
    assert.equal(home.rooms.length, 1, `seed ${seed}: two sleepers want one bedroom (${home.rooms.length})`);
    assert.equal(doors.length, home.rooms.length, `seed ${seed}: one door per room, so none is sealed in`);
    // Zone count is the point of doing this with walls: a bedroom must NOT mint
    // a zone (each one costs two full-size canvases in the render cache).
    assert.ok(
      !Object.values(w.zones).some((zone) => zone !== home && zone.name === home.name),
      `seed ${seed}: the bedroom is a partition, never a zone of its own`,
    );

    const sim = new loadedPF.Sim(w);
    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    const room = home.rooms[0];
    const taken = new Set();
    for (const name of ["Cass", "Dell"]) {
      const npc = home.npcs.find((n) => n.name === name);
      assert.ok(npc, `seed ${seed}: ${name} is home at 23:00`);
      assert.ok(
        npc.x >= room.x0 && npc.x <= room.x1 && npc.y >= room.y0 && npc.y <= room.y1,
        `seed ${seed}: ${name} sleeps INSIDE the bedroom (${npc.x},${npc.y} vs ${room.x0}..${room.x1})`,
      );
      const tile = `${npc.x},${npc.y}`;
      assert.ok(!taken.has(tile), `seed ${seed}: ${name} shares tile ${tile} with the other sleeper`);
      taken.add(tile);
      assert.equal(
        home.object[home.w * npc.y + npc.x],
        "bed",
        `seed ${seed}: two in a room this size is not dense, so a single bed each`,
      );
    }
    assert.equal(taken.size, 2, `seed ${seed}: two sleepers, two tiles`);

    // And it is ENCLOSED: shut the bedroom door and the beds fall off the map.
    // Every other assertion above passes on a partition of loose wall stubs;
    // this is the one that says the walls actually join up.
    const shut = floodFill(home, home.spawn, new Set([`${room.doorX},${room.y1 + 1}`]));
    for (const bed of home.beds) {
      assert.ok(
        !shut.has(`${bed.x},${bed.y}`),
        `seed ${seed}: closing the bedroom door leaves ${bed.x},${bed.y} open — the room has no walls`,
      );
    }
    assert.ok(shut.has(`${home.spawn.x},${home.spawn.y}`), `seed ${seed}: the flood ran at all`);
  }
}

// 55. A BIG FAMILY KEEPS ITS BEDROOMS. Five and six under one roof used to fall
// straight out of the partition into an open dormitory, because a bedroom held
// two single beds and nothing else — so a household at CAPS.household lost its
// walls and compiled to a barracks, the one reading rooms were added to prevent.
// A bedroom takes a BUNK now, so the ROOM absorbs the density instead. Asserted
// as the PRESENCE of the partition in the tiles plus the furniture the density
// bought; four is the other side of the line and never touches a bunk, so
// neither half can go vacuous.
{
  for (const seed of [1, 3, 11]) {
    for (const size of [5, 6]) {
      const sealed = brief.validate(houseBrief("Kinfold", size, "folk"), ctx);
      assert.equal(
        sealed.cast.filter((c) => c.household === sealed.cast[0].household).length,
        size,
        `the ${size}-person household survives validation — a split would make this vacuous`,
      );
      const w = world.build(seed, "cozy-village", sealed);
      const home = findZone(w, "Kin0's home");
      assert.ok(home, `seed ${seed}: the ${size}-person household compiled a dwelling`);
      // A household this size is LARGE, so its bedrooms are up the stairs (0.8.0
      // floors). Which floor they are on is not what this case is about — that a
      // big family keeps WALLS instead of falling into a dormitory is — so it
      // asks where the bedrooms are rather than assuming.
      const sleeping = bedFloor(w, home);
      const { walls, doors } = partitionTiles(sleeping);
      assert.ok(walls.length > 0, `seed ${seed}: ${size} sleepers keep an interior wall run`);
      assert.equal(sleeping.rooms.length, 2, `seed ${seed}: ${size} sleepers, two bedrooms (${sleeping.rooms.length})`);
      assert.equal(doors.length, sleeping.rooms.length, `seed ${seed}: one door per bedroom, so nobody is sealed in`);
      assert.ok(home.beds.length >= size, `seed ${seed}: ${size} sleepers, ${home.beds.length} places`);
      assert.ok(
        sleeping.rooms.some((room) => room.beds.every((bed) => sleeping.object[sleeping.w * bed.y + bed.x] === "bunk")),
        `seed ${seed}: the crowded bedroom bunks rather than the house losing its walls`,
      );
      // And every bedroom is a ROOM: shut its door and its beds leave the map.
      // Without this the case passes on a partition of loose wall stubs.
      for (const room of sleeping.rooms) {
        const shut = floodFill(sleeping, sleeping.spawn, new Set([`${room.doorX},${room.y1 + 1}`]));
        for (const bed of room.beds) {
          assert.ok(
            !shut.has(`${bed.x},${bed.y}`),
            `seed ${seed}: closing the bedroom door leaves ${bed.x},${bed.y} open — the room has no walls`,
          );
        }
      }
      // A partition is still not a zone. Two bedrooms cost ONE storey between
      // them, not one zone each — which is the whole reason a bedroom is walls
      // and a floor is a zone.
      assert.equal(
        Object.values(w.zones).filter((z) => z.id === home.id || z.id.startsWith(`${home.id}`)).length,
        floorIds(w, home.id).length,
        `seed ${seed}: the bedrooms mint no zones of their own`,
      );
      assert.ok(floorIds(w, home.id).length <= 3, `seed ${seed}: a building is a ground floor and at most two floors`);
    }

    // Four fits the two rooms on singles: density decides, and there is none.
    const roomy = brief.validate(houseBrief("Fourfold", 4, "folk"), ctx);
    const fourW = world.build(seed, "cozy-village", roomy);
    const four = findZone(fourW, "Kin0's home");
    assert.ok(four, `seed ${seed}: the smaller household compiled a dwelling`);
    const fourBeds = bedFloor(fourW, four);
    assert.ok(partitionTiles(fourBeds).walls.length > 0, `seed ${seed}: four sleepers still get bedrooms`);
    assert.equal(fourBeds.rooms.length, 2, `seed ${seed}: four sleepers, two bedrooms of two`);
    assert.ok(
      fourBeds.beds.every((bed) => fourBeds.object[fourBeds.w * bed.y + bed.x] === "bed"),
      `seed ${seed}: two to a room is not dense, so no bunk appears`,
    );
  }
}

// 55b. The worked example the shape exists for: one adult and three children
// read as a HOME. Bedrooms, a place each, and no dormitory anywhere near it —
// which is precisely what four sleepers used to be one person away from. The
// cast kinds are mixed on purpose and the assertions never mention them: the
// arrangement has to come out of the arithmetic, not out of who is in the house.
{
  const family = {
    scale: "village",
    name: "Ashfold",
    places: [{ kind: "gathering", name: "The Ashfold Lamp" }],
    cast: [
      { name: "Mera", role: "weaver", kind: "folk", tint: "blue", home: "Ashfold", household: 1 },
      { name: "Pip", role: "ward", kind: "child", tint: "green", home: "Ashfold", household: 1 },
      { name: "Nel", role: "ward", kind: "child", tint: "amber", home: "Ashfold", household: 1 },
      { name: "Rill", role: "ward", kind: "child", tint: "rose", home: "Ashfold", household: 1 },
      { name: "Perrin", role: "innkeep", kind: "host", tint: "orange", home: "The Ashfold Lamp", household: 2 },
    ],
  };
  const sealed = brief.validate(family, ctx);
  assert.equal(
    sealed.cast.filter((c) => c.household === 1).length,
    4,
    "all four stay one household — a split would test a different house",
  );
  for (const seed of [1, 3, 11, 424242]) {
    const w = world.build(seed, "cozy-village", sealed);
    checkWorld(w, sealed, `family seed ${seed}`);
    const home = findZone(w, "Mera's home");
    assert.ok(home, `seed ${seed}: the family compiled a dwelling`);
    // Four under one roof is a LARGE household, so the bedrooms are up the
    // stairs. That they are BEDROOMS rather than four beds in a row is what this
    // case is about, and it reads the same on either floor.
    const sleeping = bedFloor(w, home);
    assert.ok(sleeping.rooms.length >= 2, `seed ${seed}: it is a home with bedrooms (${sleeping.rooms.length})`);
    assert.ok(partitionTiles(sleeping).walls.length > 0, `seed ${seed}: and the walls are in the tiles`);
    assert.ok(home.beds.length >= 4, `seed ${seed}: a sleeping place each (${home.beds.length})`);
    // Nobody is left in the open: every sleeping place is inside a bedroom.
    for (const bed of home.beds) {
      assert.ok(
        sleeping.rooms.some((room) => bed.x >= room.x0 && bed.x <= room.x1 && bed.y >= room.y0 && bed.y <= room.y1),
        `seed ${seed}: ${bed.x},${bed.y} is a bed in a room, not four in a row across the floor`,
      );
    }
    const sim = new loadedPF.Sim(w);
    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    const taken = new Set();
    for (const name of ["Mera", "Pip", "Nel", "Rill"]) {
      const npc = sleeping.npcs.find((n) => n.name === name);
      assert.ok(npc, `seed ${seed}: ${name} is home at 23:00`);
      assert.ok(SLEEPS_ON.has(standingOn(sleeping, npc)), `seed ${seed}: ${name} is in a bed`);
      assert.ok(
        sleeping.rooms.some((room) => npc.x >= room.x0 && npc.x <= room.x1 && npc.y >= room.y0 && npc.y <= room.y1),
        `seed ${seed}: ${name} sleeps inside a bedroom (${npc.x},${npc.y})`,
      );
      assert.ok(!taken.has(`${npc.x},${npc.y}`), `seed ${seed}: ${name} shares a tile with a housemate`);
      taken.add(`${npc.x},${npc.y}`);
    }
  }
}

// 56. The inn's guests get ROOMS. One drifter sleeps behind a door of their own;
// a crowded inn packs the rooms that need it with bunks and leaves the room that
// does not with single beds — same building, same seed, only the density differs.
{
  const sealed = brief.validate(bedsBrief(), ctx);
  for (const seed of [1, 31, 424242]) {
    const w = world.build(seed, "cozy-village", sealed);
    const inn = findZone(w, "The Kettle");
    assert.ok(inn, `seed ${seed}: the gathering compiled`);
    // GUEST ROOMS UPSTAIRS (0.8.0 floors) — the classic inn. The wing is the same
    // wing it always was, laid by the same plan; only the zone it sits in moved,
    // so every assertion below reads the storey instead of the tap room.
    const wing = w.zones[`${inn.id}u`];
    assert.ok(wing, `seed ${seed}: the inn grew a guest storey`);
    assert.ok(wing.rooms.length >= 1, `seed ${seed}: the inn has guest rooms (${wing.rooms.length})`);
    assert.equal(
      partitionTiles(wing).doors.length,
      wing.rooms.length,
      `seed ${seed}: every guest room has a door — a guest walled in is un-talkable forever`,
    );
    for (const room of wing.rooms) {
      assert.ok(room.beds.length >= 1, `seed ${seed}: a guest room with no bed in it is a cupboard`);
      // A guest room is a room: its door is the only way in. Otherwise "guest
      // room" is a label on a corner of the common floor, which is what 0.7.x
      // already had.
      const shut = floodFill(wing, wing.spawn, new Set([`${room.doorX},${room.y1 + 1}`]));
      for (const bed of room.beds) {
        assert.ok(
          !shut.has(`${bed.x},${bed.y}`),
          `seed ${seed}: closing the guest room door leaves ${bed.x},${bed.y} open to the landing`,
        );
      }
    }
    const sim = new loadedPF.Sim(w);
    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    const wisp = wing.npcs.find((npc) => npc.name === "Wisp");
    assert.ok(wisp, `seed ${seed}: the drifter beds down in the inn's guest rooms`);
    const host = wing.rooms.find(
      (room) => wisp.x >= room.x0 && wisp.x <= room.x1 && wisp.y >= room.y0 && wisp.y <= room.y1,
    );
    assert.ok(host, `seed ${seed}: and inside one of them (${wisp.x},${wisp.y})`);
    assert.equal(standingOn(wing, wisp), "bed", `seed ${seed}: a solo guest gets a bed, not a bunk`);
  }

  // A thriving village builds seven berths over its three rooms → 3, 2, 2. The
  // three outruns what single beds fit along that room's wall and bunks; the twos
  // do not and do not. Same building, same seed — only the density differs.
  const cast = [{ name: "Host", role: "innkeep", kind: "host", tint: "orange", home: "The Long Rest", household: 1 }];
  for (let i = 0; i < 8; i++) {
    cast.push({
      name: `T${i}`,
      role: "drover",
      kind: "folk",
      tint: ["blue", "green", "amber", "rose", "teal", "violet", "grey", "red"][i],
      home: "Waystop",
      household: 2 + ((i / 3) | 0),
      standing: "transient",
    });
  }
  const busy = brief.validate(
    {
      scale: "village",
      prosperity: "thriving",
      name: "Waystop",
      places: [{ kind: "gathering", name: "The Long Rest" }],
      cast,
    },
    ctx,
  );
  assert.equal(busy.cast.filter((c) => c.standing === "transient").length, 8, "eight guests survive validation");
  for (const seed of [1, 5, 31]) {
    const w = world.build(seed, "cozy-village", busy);
    const inn = findZone(w, "The Long Rest");
    assert.ok(inn, `seed ${seed}: the busy inn compiled`);
    const wing = w.zones[`${inn.id}u`];
    assert.ok(wing, `seed ${seed}: with its guest storey over it`);
    const types = wing.rooms.map((room) => new Set(room.beds.map((bed) => wing.object[wing.w * bed.y + bed.x])));
    assert.ok(
      types.some((set) => set.has("bunk")),
      `seed ${seed}: the crowded guest rooms are bunked`,
    );
    assert.ok(
      types.some((set) => set.size === 1 && set.has("bed")),
      `seed ${seed}: and the room that is NOT crowded keeps single beds — density decides, not the building`,
    );
    // Everyone still lands on a tile of their own, wherever in the building they
    // ended up — the overflow stays in the tap room while the berths fill upstairs.
    const sim = new loadedPF.Sim(w);
    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    const taken = new Set();
    for (const { zone, npc } of underRoof(w, inn.id)) {
      const tile = `${zone.id}:${Math.round(npc.x)},${Math.round(npc.y)}`;
      assert.ok(!taken.has(tile), `seed ${seed}: ${npc.name} stacked on tile ${tile} in the inn`);
      taken.add(tile);
    }
    const guests = underRoof(w, inn.id).filter(({ npc }) => npc.name.startsWith("T"));
    assert.ok(guests.length >= 6, `seed ${seed}: the inn genuinely fills up (${guests.length} guests)`);
  }
}

// 57. Bunks come from the ROOM, never from who is sleeping in it. Two fixtures
// identical but for the cast kind — six children, six adults — must compile to
// the same sleeping tiles, so no rule of the form `kind === "child"` (or its
// mirror, "adults only") can survive here. And a lone child gets a plain single
// bed: one sleeper is not dense, whatever their age.
{
  for (const seed of [1, 3, 11]) {
    // Six is a LARGE household, so the sleeping rooms are up the stairs (0.8.0
    // floors). The question here is whose beds they are, which the floor does not
    // change — so both fixtures are compared on the floor their bedrooms are on.
    const built = (kind) => {
      const w = world.build(seed, "cozy-village", brief.validate(houseBrief("Wardhome", 6, kind), ctx));
      const home = findZone(w, "Kin0's home");
      assert.ok(home, `seed ${seed}: the ${kind} household compiled a dwelling`);
      return bedFloor(w, home);
    };
    const wards = built("child");
    const adults = built("folk");
    // Non-vacuous: both really are dense, and dense really does mean bunks.
    assert.equal(wards.beds.length, 6, `seed ${seed}: six wards, six places`);
    assert.ok(
      wards.beds.every((bed) => wards.object[wards.w * bed.y + bed.x] === "bunk"),
      `seed ${seed}: a house full of children at that density gets bunks`,
    );
    assert.ok(
      adults.beds.every((bed) => adults.object[adults.w * bed.y + bed.x] === "bunk"),
      `seed ${seed}: and so does a barracks of adults at the same density`,
    );
    assert.deepEqual(
      adults.object,
      wards.object,
      `seed ${seed}: the two interiors are tile-for-tile identical — the rule never read the cast`,
    );

    // The other direction: one child, alone in a bedroom, sleeps in a bed — and
    // on the GROUND floor, because one sleeper is a cottage and a cottage earns
    // no staircase (the upper-storey gate).
    const loneW = world.build(seed, "cozy-village", brief.validate(houseBrief("Onefold", 1, "child"), ctx));
    const lone = findZone(loneW, "Kin0's home");
    assert.ok(lone, `seed ${seed}: the one-child household compiled a dwelling`);
    assert.equal(loneW.zones[`${lone.id}u`], undefined, `seed ${seed}: and no storey over it`);
    assert.equal(lone.beds.length, 1, `seed ${seed}: one sleeper, one place`);
    assert.equal(
      lone.object[lone.w * lone.beds[0].y + lone.beds[0].x],
      "bed",
      `seed ${seed}: a lone child does not force a bunk — density does, and there is none`,
    );
    assert.ok(partitionTiles(lone).walls.length > 0, `seed ${seed}: and they still get a bedroom of their own`);
  }
}

// 58. Every sleeping tile is reachable on foot from the interior's entrance. A
// bedroom whose door gap was forgotten walls its sleeper off: the player can
// never reach them, and 25-schedule's placer would ring-scan them out of the
// room the compiler put them in. Flooded from the tile inside the front door,
// across every fixture in this file that sleeps anyone.
{
  const fixtures = [
    ["hearthwick", brief.validate(bedsBrief(), ctx)],
    ["bunked-bedrooms", brief.validate(houseBrief("Sixfold", 6, "folk"), ctx)],
    ["four", brief.validate(houseBrief("Fourfold", 4, "child"), ctx)],
    ["lone", brief.validate(houseBrief("Onefold", 1, "folk"), ctx)],
    ["dormitory", brief.validate(bunkhouseBrief(5), ctx)],
    ["town-inn", brief.validate({ ...bedsBrief(), scale: "town", prosperity: "thriving" }, ctx)],
    ["defaults", brief.defaults("cozy-village", 424242)],
    ["colony", brief.defaults("sci-fi-colony", 424242)],
  ];
  let checked = 0;
  for (const [label, sealed] of fixtures) {
    for (const seed of [1, 3, 11, 424242]) {
      const w = world.build(seed, "cozy-village", sealed);
      for (const zone of Object.values(w.zones)) {
        // A building's `beds` list SPANS its floors (0.8.0), so ask each zone
        // about the sleeping tiles that are actually in it: flooding a ground
        // floor for a tile up the stairs would prove nothing either way. Quarters
        // ride along, which is free and strictly more coverage than before.
        const sleeping = [...(zone.beds ?? []), ...(zone.homeBeds ?? [])].filter((bed) => bed.zoneId === zone.id);
        if (!sleeping.length) continue;
        const reached = floodFill(zone, zone.spawn);
        for (const bed of sleeping) {
          assert.ok(
            reached.has(`${bed.x},${bed.y}`),
            `${label} seed ${seed}: ${zone.name} walls off the sleeping tile ${bed.x},${bed.y}`,
          );
          checked++;
        }
        // And the room's own door is reachable, so the sleeper can be talked to
        // rather than merely stood next to through a wall.
        for (const room of zone.rooms) {
          assert.ok(
            reached.has(`${room.doorX},${room.y1 + 1}`),
            `${label} seed ${seed}: ${zone.name} has an unreachable room door at ${room.doorX},${room.y1 + 1}`,
          );
        }
      }
    }
  }
  assert.ok(checked > 100, `the sweep actually visited sleeping tiles (${checked})`);
}

// 59. The open plan survives, for the roof that has genuinely earned it. Bunked
// bedrooms moved the line to NINE under one roof, which is past CAPS.household —
// no family can reach it, so a dormitory is no longer something a household can
// accidentally become. The compiler's own over-subscription merge reaches it:
// six households squeezed onto the last free lot is a bunkhouse, and a bunkhouse
// is what `dormitory()` was always for. Eight is the other side of the line and
// keeps its bedrooms, so neither half is vacuous.
{
  for (const seed of [1, 3, 11]) {
    const roofs = {};
    for (const [label, hands] of [
      ["eight", 4],
      ["nine", 5],
    ]) {
      const sealed = brief.validate(bunkhouseBrief(hands), ctx);
      assert.equal(sealed._repairs.length, 0, `${label}: the fixture seals untouched (${sealed._repairs.join("; ")})`);
      const w = world.build(seed, "cozy-village", sealed);
      const roof = findZone(w, "Ada's home");
      assert.ok(roof, `seed ${seed}: the ${label}-sleeper roof compiled`);
      // Non-vacuous in the way that matters: this is a MERGED block — several
      // whole households under one roof — not one household over its cap, which
      // the validator would have split before the compiler ever saw it.
      const households = new Set(sealed.cast.map((member) => member.household));
      assert.ok(households.size > 1, `seed ${seed}: ${households.size} households share the roof, so the merge fired`);
      // A MERGED block sleeps upstairs (0.8.0 floors), so the handle that sends
      // somebody to bed names the storey. Whether it is one floor or two, the
      // question is the same one: everybody who lives here sleeps here.
      const under = new Set(floorIds(w, roof.id));
      const sleepers = Object.values(w.zones)
        .flatMap((zone) => zone.npcs)
        .filter((npc) => under.has(npc._sched.home?.zoneId));
      assert.equal(sleepers.length, 4 + hands, `seed ${seed}: everyone in the ${label} fixture sleeps under it`);
      roofs[label] = bedFloor(w, roof);
    }
    // Eight is a crowded house and keeps its walls; nine is an institution.
    assert.ok(partitionTiles(roofs.eight).walls.length > 0, `seed ${seed}: eight under one roof still get bedrooms`);
    assert.equal(roofs.eight.rooms.length, 2, `seed ${seed}: two bedrooms, four to a room, all of them bunked`);
    assert.ok(
      roofs.eight.beds.every((bed) => roofs.eight.object[roofs.eight.w * bed.y + bed.x] === "bunk"),
      `seed ${seed}: four to a bedroom is the wall run bunked`,
    );
    const open = partitionTiles(roofs.nine);
    assert.equal(open.walls.length, 0, `seed ${seed}: nine goes open (${open.walls.join(" ")})`);
    assert.equal(open.doors.length, 0, `seed ${seed}: and has no interior doors (${open.doors.join(" ")})`);
    assert.equal(roofs.nine.rooms.length, 0, `seed ${seed}: and the compiler agrees it partitioned nothing`);
    assert.equal(roofs.nine.beds.length, 9, `seed ${seed}: nine sleepers, nine places`);
    for (const bed of roofs.nine.beds) {
      assert.equal(
        roofs.nine.object[roofs.nine.w * bed.y + bed.x],
        "bunk",
        `seed ${seed}: a bunkhouse sleeps its people in bunks (${bed.x},${bed.y})`,
      );
    }
  }

  // And the bunkhouse world holds every NPC invariant the others do, around the
  // clock: nine people resolving to one interior is the densest night the
  // compiler can produce, which is exactly where stacking would show up first.
  const sealed = brief.validate(bunkhouseBrief(5), ctx);
  for (const seed of [1, 3, 11]) {
    const w = world.build(seed, "cozy-village", sealed);
    const sim = new loadedPF.Sim(w);
    for (const min of [6 * 60, 12 * 60, 19 * 60, 23 * 60]) {
      sim.clockMin = min;
      sim.resolveSchedules();
      for (const zoneId in w.zones) {
        const z = w.zones[zoneId];
        const taken = new Set();
        for (const npc of z.npcs) {
          const x = Math.round(npc.x);
          const y = Math.round(npc.y);
          assert.ok(
            loadedPF.schedule.standable(z, x, y),
            `seed ${seed} @${min}: ${npc.name} stands somewhere legal in ${zoneId}`,
          );
          assert.ok(!taken.has(`${x},${y}`), `seed ${seed} @${min}: ${npc.name} shares a tile in ${zoneId}`);
          taken.add(`${x},${y}`);
        }
      }
    }
  }
}

// 60. THE INN IS BUILT TO A CAPACITY, never counted out of the guest list. Sized
// from however many transients the brief happened to name, the guest wing had a
// berth per drifter and not one spare — the inn was never quiet and never full,
// which is the one thing an inn is not for. It is sized from `scale` and
// `prosperity` now, so the same settlement builds the same wing whether nobody
// turns up or more people do than it holds.
const innBrief = (overrides, guests) => ({
  scale: "village",
  name: "Waystop",
  places: [{ kind: "gathering", name: "The Long Rest" }],
  cast: [
    { name: "Ada", role: "reeve", kind: "leader", tint: "blue", home: "Waystop", household: 1 },
    { name: "Perrin", role: "innkeep", kind: "host", tint: "orange", home: "The Long Rest", household: 2 },
    { name: "Cass", role: "cooper", kind: "folk", tint: "amber", home: "Waystop", household: 3 },
    { name: "Dell", role: "carter", kind: "folk", tint: "rose", home: "Waystop", household: 3 },
    ...Array.from({ length: guests }, (_, i) => ({
      name: `T${i}`,
      role: "drover",
      kind: "folk",
      tint: ["green", "teal", "violet", "grey", "red", "blue"][i % 6],
      home: "Waystop",
      household: 4,
      standing: "transient",
    })),
  ],
  ...overrides,
});
{
  const innOf = (w) => findZone(w, "The Long Rest");
  // The wing is UPSTAIRS (0.8.0 floors): the inn is one building with a tap room
  // and a landing of let rooms over it. `beds` is still asked of the building,
  // because "the fourth berth at the inn" cannot depend on which floor it is on.
  const wingOf = (w) => w.zones[`${innOf(w).id}u`];
  // The headline: an empty road and a crowded one build the SAME wing, tile for
  // tile. Anything that read the cast to size the guest rooms shows up here.
  for (const seed of [1, 5, 31, 424242]) {
    const quietW = world.build(seed, "cozy-village", brief.validate(innBrief({}, 0), ctx));
    const crowdedW = world.build(seed, "cozy-village", brief.validate(innBrief({}, 6), ctx));
    const quiet = innOf(quietW);
    const crowded = innOf(crowdedW);
    assert.ok(quiet && crowded, `seed ${seed}: both inns compiled`);
    // GUEST rooms are the storey's; the keeper's own quarters (Perrin is homed at
    // The Long Rest) stay downstairs behind the tap room, which is where a keeper
    // lives — the two lists were always carved from different bands.
    const guestRooms = (w) => wingOf(w).rooms.filter((room) => !room.quarters);
    assert.ok(guestRooms(quietW).length >= 3, `seed ${seed}: a village inn with no guests still has its wing`);
    assert.ok(quiet.beds.length >= guestRooms(quietW).length, `seed ${seed}: and a berth in every room of it`);
    assert.deepEqual(
      wingOf(crowdedW).object,
      wingOf(quietW).object,
      `seed ${seed}: the guest wing is the same wing either way`,
    );
    assert.deepEqual(crowded.object, quiet.object, `seed ${seed}: and the tap room under it is the same room`);
    assert.equal(
      JSON.stringify(crowded.beds),
      JSON.stringify(quiet.beds),
      `seed ${seed}: and the same berths, in the same claim order`,
    );
  }

  // Both axes move it, and only the table decides: zero transients throughout,
  // so nothing here can be reading the cast. `scale` is the size axis…
  const berths = (overrides) =>
    innOf(world.build(424242, "cozy-village", brief.validate(innBrief(overrides, 0), ctx))).beds.length;
  const bySize = ["outpost", "hamlet", "village", "town"].map((scale) => berths({ scale }));
  assert.deepEqual(bySize, [4, 5, 6, 9], `a bigger settlement builds a bigger inn (${bySize.join(",")})`);
  // …and `prosperity` is the means axis, a step either side of it.
  const byMeans = ["struggling", "modest", "thriving"].map((prosperity) => berths({ prosperity }));
  assert.deepEqual(byMeans, [5, 6, 7], `a richer village builds a roomier inn (${byMeans.join(",")})`);
  assert.equal(byMeans[1], bySize[2], "modest is the neutral step, so the two axes agree on a modest village");

  // The whole table, pinned. It is written to stay inside what the wing can
  // physically be — never under the rooms the band carves, never over what those
  // rooms hold bunked — and that is a property of the NUMBERS rather than of a
  // clamp, so it is checked here rather than defended in the compiler. Every
  // combination, zero transients throughout.
  const built = {};
  for (const scale of ["outpost", "hamlet", "village", "town"]) {
    for (const prosperity of ["struggling", "modest", "thriving"]) {
      const w = world.build(424242, "cozy-village", brief.validate(innBrief({ scale, prosperity }, 0), ctx));
      const inn = innOf(w);
      const label = `${scale}/${prosperity}`;
      built[label] = inn.beds.length;
      // Over the top of the range the wing stops being a wing: it falls through
      // to the open plan and the inn is a bunkhouse with a bar.
      const wing = w.zones[`${inn.id}u`];
      const guests = wing.rooms.filter((room) => !room.quarters);
      assert.ok(guests.length > 0, `${label}: the inn keeps guest ROOMS`);
      for (const floor of [inn, wing]) {
        assert.equal(partitionTiles(floor).doors.length, floor.rooms.length, `${label}: a door on every room`);
      }
      // Under the bottom of it, rooms outnumber berths and one is a cupboard.
      assert.ok(inn.beds.length >= guests.length, `${label}: ${guests.length} guest rooms, ${inn.beds.length} berths`);
      assert.equal(
        inn.beds.length,
        new Set(inn.beds.map((bed) => `${bed.zoneId}:${bed.x},${bed.y}`)).size,
        `${label}: no berth is dealt twice`,
      );
    }
  }
  assert.deepEqual(
    built,
    {
      "outpost/struggling": 3,
      "outpost/modest": 4,
      "outpost/thriving": 5,
      "hamlet/struggling": 4,
      "hamlet/modest": 5,
      "hamlet/thriving": 6,
      "village/struggling": 5,
      "village/modest": 6,
      "village/thriving": 7,
      "town/struggling": 8,
      "town/modest": 9,
      "town/thriving": 10,
    },
    `every settlement builds the inn its size and means say (${JSON.stringify(built)})`,
  );

  // Over-subscription: more guests than berths still puts everyone somewhere.
  // The berths go in cast order and whoever arrives after the last one takes the
  // common room, which is the fallback that has always been there.
  const packed = brief.validate(innBrief({ prosperity: "struggling" }, 6), ctx);
  assert.equal(packed.cast.filter((c) => (c.standing ?? "resident") === "transient").length, 6, "six guests sealed");
  for (const seed of [1, 5, 31]) {
    const w = world.build(seed, "cozy-village", packed);
    const inn = innOf(w);
    assert.ok(inn.beds.length < 6, `seed ${seed}: the fixture really does over-subscribe (${inn.beds.length} berths)`);
    const sim = new loadedPF.Sim(w);
    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    // The building, both floors: the berths fill upstairs and whoever arrives
    // after the last one is still down in the common room, which is what "no room
    // left" has always meant.
    const guests = underRoof(w, inn.id).filter(({ npc }) => npc.name.startsWith("T"));
    assert.equal(guests.length, 6, `seed ${seed}: every guest beds down at the inn (${guests.length})`);
    const taken = new Set();
    let inBed = 0;
    for (const { zone, npc } of guests) {
      const tile = `${zone.id}:${npc.x},${npc.y}`;
      assert.ok(!taken.has(tile), `seed ${seed}: ${npc.name} stacked on tile ${tile}`);
      taken.add(tile);
      assert.ok(loadedPF.schedule.standable(zone, npc.x, npc.y), `seed ${seed}: ${npc.name} stands somewhere legal`);
      if (SLEEPS_ON.has(standingOn(zone, npc))) inBed++;
    }
    assert.equal(inBed, inn.beds.length, `seed ${seed}: every berth is claimed (${inBed} of ${inn.beds.length})`);
    assert.ok(inBed < guests.length, `seed ${seed}: and the overflow is genuinely bedless, in the common room`);
  }
}

// ── Live-work premises: a workplace is a home (0.8.0) ────────────────────────
// The complaint this answers: a tradesman consumed TWO of a settlement's lots —
// the shop they worked AND a separate house — for ONE household. Lot supply is
// tiny at the small end (an outpost's rows fit two buildings), so the specials
// ate every lot and NO household got a dwelling: nobody was in a bed at night at
// the two smallest scales, which is the whole of what 0.8.0 was for.

/** A settlement with one of each side of the split: a smith who lives over the
 *  forge with their child (LIVE-WORK), a farming family (LIVE-WORK), a watchman
 *  who keeps a post nobody lives in (DUTY STATION), and an innkeep homed at the
 *  inn the brief named. */
const liveWorkBrief = (overrides = {}) => ({
  scale: "village",
  name: "Anvilrest",
  places: [{ kind: "gathering", name: "The Anvil" }],
  cast: [
    { name: "Sten", role: "smith", kind: "maker", tint: "amber", home: "Anvilrest", household: 1 },
    { name: "Wren", role: "apprentice", kind: "child", tint: "green", home: "Anvilrest", household: 1 },
    { name: "Tam", role: "farmer", kind: "grower", tint: "teal", home: "Anvilrest", household: 2 },
    { name: "Gil", role: "watch", kind: "guard", tint: "blue", home: "Anvilrest", household: 3 },
    { name: "Perrin", role: "innkeep", kind: "host", tint: "orange", home: "The Anvil", household: 4 },
  ],
  ...overrides,
});

// 61. A TRADE HOUSEHOLD SLEEPS IN ITS WORKPLACE. The smith and their child are
// both inside the smithy at 23:00, on sleeping tiles of their own, behind a
// bedroom door laid by the same machinery any other family gets — and no second
// "Sten's home" roof exists anywhere, which is the lot the old shape wasted.
{
  const sealed = brief.validate(liveWorkBrief(), ctx);
  assert.equal(
    sealed.cast.filter((c) => c.household === 1).length,
    2,
    "the smith and the child stay ONE household — a split would test a different building",
  );
  for (const seed of [1, 3, 11, 424242]) {
    const w = world.build(seed, "cozy-village", sealed);
    checkWorld(w, sealed, `live-work seed ${seed}`);
    const forge = findZone(w, "Sten's shop");
    assert.ok(forge, `seed ${seed}: the smithy compiled a room`);
    assert.equal(forge.mapExport, false, `seed ${seed}: it is a building, not a second map destination`);
    assert.ok(
      !Object.values(w.zones).some((zone) => zone.name === "Sten's home"),
      `seed ${seed}: and no separate house is minted for the same household`,
    );
    // The same rooms-and-beds machinery, not a special case — and the smith who
    // RUNS the forge gets a room of his own, so the child gets the other.
    assert.equal(forge.rooms.length, 2, `seed ${seed}: the smith's room and the child's (${forge.rooms.length})`);
    assert.equal(partitionTiles(forge).doors.length, 2, `seed ${seed}: a door on each`);
    const own = forge.rooms.find((room) => room.private);
    assert.ok(own, `seed ${seed}: one of them is the owner's own`);
    assert.equal(own.beds.length, 1, `seed ${seed}: single occupancy (${own.beds.length} beds)`);
    assert.ok(forge.object.includes("counter"), `seed ${seed}: it is still a shop — a counter to be served over`);

    const sim = new loadedPF.Sim(w);
    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    const taken = new Set();
    for (const name of ["Sten", "Wren"]) {
      const npc = forge.npcs.find((n) => n.name === name);
      assert.ok(npc, `seed ${seed}: ${name} is inside the smithy at 23:00`);
      assert.ok(SLEEPS_ON.has(forge.object[forge.w * npc.y + npc.x]), `seed ${seed}: ${name} is in a bed`);
      assert.ok(
        forge.rooms.some((room) => npc.x >= room.x0 && npc.x <= room.x1 && npc.y >= room.y0 && npc.y <= room.y1),
        `seed ${seed}: ${name} sleeps inside the bedroom (${npc.x},${npc.y})`,
      );
      assert.ok(!taken.has(`${npc.x},${npc.y}`), `seed ${seed}: ${name} shares a tile with the other sleeper`);
      taken.add(`${npc.x},${npc.y}`);
    }
    // By day the shop is a shop: the owner mans the counter, the child does not.
    sim.clockMin = 12 * 60;
    sim.resolveSchedules();
    const sten = forge.npcs.find((n) => n.name === "Sten");
    assert.ok(sten, `seed ${seed}: the smith works the shop by day`);
    assert.equal(
      forge.object[forge.w * (sten.y + 1) + sten.x],
      "counter",
      `seed ${seed}: standing behind the counter, not out in front of it`,
    );
    assert.ok(
      !forge.npcs.some((n) => n.name === "Wren"),
      `seed ${seed}: the smith's child is not put to work behind the counter`,
    );
    // The counter is the OWNER's station, not the household's. Living over the
    // shop moved the whole family into the building's records, and a plain
    // "lives here" test would have put the child on the shop's work post too.
    const wrenSched = Object.values(w.zones)
      .flatMap((zone) => zone.npcs)
      .find((npc) => npc.name === "Wren")._sched;
    assert.equal(
      wrenSched.post.zoneId,
      "z1",
      `seed ${seed}: the child's day anchor is the settlement, not the counter`,
    );
    sim.clockMin = 19 * 60;
    sim.resolveSchedules();
    assert.ok(
      !forge.npcs.some((n) => n.name === "Wren"),
      `seed ${seed}: and at dusk they are out on the apron, not behind the counter`,
    );
    assert.ok(
      forge.npcs.some((n) => n.name === "Sten"),
      `seed ${seed}: while the smith is still working the shop`,
    );
  }
}

// 62. A farm is a farmHOUSE, and a guard post is not. `grower -> farm` gained an
// interior because a farming family lives on the farm; `guard -> post` stays a
// facade on purpose (maintainer call) — nobody lives in a duty station, so the
// watchman keeps an ordinary household dwelling and the post mints no zone at
// all. Both halves are asserted, so neither can quietly flip.
{
  const sealed = brief.validate(liveWorkBrief(), ctx);
  for (const seed of [1, 3, 11, 424242]) {
    const w = world.build(seed, "cozy-village", sealed);
    const farm = findZone(w, "Tam's farm");
    assert.ok(farm, `seed ${seed}: the farm compiled an interior`);
    assert.equal(farm.mapExport, false, `seed ${seed}: a farmhouse is a building, not a map destination`);
    assert.ok(farm.beds.length >= 1, `seed ${seed}: with a bed in it (${farm.beds.length})`);
    // Reachable on foot from the settlement, both ways.
    assert.ok(
      w.zones.z1.portals.some((portal) => portal.toZone === farm.id),
      `seed ${seed}: the settlement has a door into the farm`,
    );
    assert.ok(
      farm.portals.some((portal) => portal.toZone === "z1"),
      `seed ${seed}: and the farm has one back out`,
    );
    for (const bed of farm.beds) {
      assert.ok(
        floodFill(farm, farm.spawn).has(`${bed.x},${bed.y}`),
        `seed ${seed}: the farm's bed at ${bed.x},${bed.y} is walled off`,
      );
    }

    // The post: no interior anywhere, and its door opens onto nothing. Counted
    // against the doors so the claim cannot go vacuous by the post vanishing.
    assert.ok(
      !Object.values(w.zones).some((zone) => zone.name === "Gil's post"),
      `seed ${seed}: a duty station mints no zone to sleep in`,
    );
    const v = w.zones.z1;
    const doorTiles = new Set();
    v.object.forEach((tile, index) => {
      if (tile === "door") doorTiles.add(`${index % v.w},${(index / v.w) | 0}`);
    });
    const opened = new Set(v.portals.filter((p) => doorTiles.has(`${p.x},${p.y}`)).map((p) => p.toZone));
    assert.equal(
      doorTiles.size,
      5,
      `seed ${seed}: inn, smithy, farm, post and the watchman's house (${doorTiles.size})`,
    );
    assert.equal(opened.size, 4, `seed ${seed}: four of the five open — the post is the facade (${opened.size})`);

    const sim = new loadedPF.Sim(w);
    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    const tam = farm.npcs.find((npc) => npc.name === "Tam");
    assert.ok(tam, `seed ${seed}: the farmer sleeps on the farm`);
    assert.ok(SLEEPS_ON.has(farm.object[farm.w * tam.y + tam.x]), `seed ${seed}: in a bed of their own`);
    // The watchman keeps the night — that is the schedule, not a housing gap —
    // and comes off watch to a real bed in a real house of their own.
    const house = findZone(w, "Gil's home");
    assert.ok(house, `seed ${seed}: the watchman keeps an ordinary dwelling`);
    assert.ok(
      w.zones.z1.npcs.some((npc) => npc.name === "Gil"),
      `seed ${seed}: and is out on watch at 23:00`,
    );
    sim.clockMin = 6 * 60;
    sim.resolveSchedules();
    const abed = house.npcs.find((npc) => npc.name === "Gil");
    assert.ok(abed, `seed ${seed}: off watch he goes home`);
    assert.ok(SLEEPS_ON.has(house.object[house.w * abed.y + abed.x]), `seed ${seed}: to his own bed`);
  }
}

// 63. HOUSING COMPLETENESS, AT EVERY SCALE. The case the original bug would have
// tripped: at 23:00 on an outpost, with three trades in a five-person cast, not
// one resident was in a bed — the specials had eaten both of the outpost's two
// lots and no dwelling was ever built.
//
// "Everyone" here is every RESIDENT homed at the settlement root: the population
// the settlement's own housing arithmetic owes a roof. A resident the brief homed
// at a named place lives there by the brief's own instruction, and a non-resident
// (fringe, transient, destitute) is housed by their standing — case 64 pins that
// those are not counted as failures.
//
// Asserted at the daypart each NPC's own schedule sends them home, not blindly at
// 23:00: the watch keeps the night by design, so a guard is in bed at dawn. Both
// halves are checked — sent home implies in bed, and everyone reaches a bed at
// some daypart — so neither can excuse a real gap.
const DAYPART_CLOCK = { dawn: 6 * 60, day: 12 * 60, dusk: 19 * 60, night: 23 * 60 };
const SPECIAL_KINDS = ["leader", "host", "grower", "guard", "merchant", "maker", "elder"];
function assertEveryoneHoused(sealed, label, seeds = [1, 3, 11, 424242], minOwed = 3) {
  const rootName = sealed._ids.zones.z1;
  const owed = sealed.cast.filter((c) => (c.standing ?? "resident") === "resident" && c.home === rootName);
  // Non-vacuous: a cast that is empty, or that carries no trade, cannot fail the
  // way the original bug failed. `minOwed` is per-fixture because the stock
  // briefs really do only root TWO of their four (the keeper lives at the inn
  // and the forager in the woods), and a floor written for the hand-built
  // shapes would just be wrong about them rather than stricter.
  assert.ok(owed.length >= minOwed, `${label}: the fixture actually houses people (${owed.length})`);
  assert.ok(
    owed.some((member) => SPECIAL_KINDS.includes(member.kind)),
    `${label}: and at least one of them runs a special building`,
  );
  for (const seed of seeds) {
    const w = world.build(seed, "cozy-village", sealed);
    checkWorld(w, sealed, `${label} seed ${seed}`);
    const sim = new loadedPF.Sim(w);
    const slept = new Set();
    for (const [daypart, clock] of Object.entries(DAYPART_CLOCK)) {
      sim.clockMin = clock;
      sim.resolveSchedules();
      for (const member of owed) {
        const found = Object.values(w.zones)
          .map((zone) => ({ zone, npc: zone.npcs.find((n) => n.name === member.name) }))
          .find((hit) => hit.npc);
        assert.ok(found, `${label} seed ${seed} @${daypart}: ${member.name} is somewhere in the world`);
        const { zone, npc } = found;
        const sleeping = SLEEPS_ON.has(zone.object[zone.w * npc.y + npc.x]);
        // Sent to bed => IN bed. This is the assertion the bug would have fired.
        if (loadedPF.schedule.resolve(npc._sched, daypart) === npc._sched.home) {
          assert.ok(
            sleeping,
            `${label} seed ${seed} @${daypart}: ${member.name} was sent home and is not on a bed (${zone.id} ${npc.x},${npc.y})`,
          );
        }
        if (sleeping) slept.add(member.name);
      }
    }
    // And every one of them sleeps SOMEWHERE in the day — a resident whose
    // schedule never sends them to a bed is exactly the hole this case is for.
    for (const member of owed) {
      assert.ok(slept.has(member.name), `${label} seed ${seed}: ${member.name} never reaches a bed at any daypart`);
    }
  }
}
{
  // The shape from the bug report: five people, three trades, no named places.
  const tradeCast = (name) => [
    { name: "Sten", role: "smith", kind: "maker", tint: "amber", home: name, household: 1 },
    { name: "Tam", role: "farmer", kind: "grower", tint: "green", home: name, household: 2 },
    { name: "Ada", role: "reeve", kind: "leader", tint: "blue", home: name, household: 3 },
    { name: "Cass", role: "cooper", kind: "folk", tint: "rose", home: name, household: 4 },
    { name: "Dell", role: "carter", kind: "folk", tint: "teal", home: name, household: 5 },
  ];
  // A duty-heavy shape: a watch and a hall, neither of which houses anybody, so
  // every household still needs a dwelling of its own.
  const dutyCast = (name) => [
    { name: "Ada", role: "reeve", kind: "leader", tint: "blue", home: name, household: 1 },
    { name: "Gil", role: "watch", kind: "guard", tint: "red", home: name, household: 2 },
    { name: "Rin", role: "sentry", kind: "guard", tint: "grey", home: name, household: 3 },
    { name: "Cass", role: "cooper", kind: "folk", tint: "rose", home: name, household: 4 },
  ];
  // A big family plus the trades that used to displace it.
  const familyCast = (name) => [
    ...Array.from({ length: 6 }, (_, i) => ({
      name: `Kin${i}`,
      role: "hand",
      kind: i ? "child" : "folk",
      tint: ["blue", "green", "amber", "rose", "teal", "violet"][i],
      home: name,
      household: 1,
    })),
    { name: "Sten", role: "smith", kind: "maker", tint: "red", home: name, household: 2 },
    { name: "Tam", role: "farmer", kind: "grower", tint: "grey", home: name, household: 3 },
  ];
  for (const scale of ["outpost", "hamlet", "village", "town"]) {
    for (const [shape, cast, places] of [
      ["trades", tradeCast, []],
      ["duties", dutyCast, []],
      ["family", familyCast, []],
      // Named places take lots first — but never the LAST one while anybody is
      // still owed a roof, which is the reservation that makes the small scales
      // work at all.
      [
        "places",
        tradeCast,
        [
          { kind: "gathering", name: "The Kettle" },
          { kind: "hall", name: "The Moot" },
        ],
      ],
    ]) {
      const name = `${shape}-${scale}`;
      assertEveryoneHoused(brief.validate({ scale, name, places, cast: cast(name) }, ctx), `${shape}/${scale}`);
    }
  }
  // Both stock briefs, at every scale, for the same promise.
  for (const theme of ["cozy-village", "sci-fi-colony"]) {
    for (const scale of ["outpost", "hamlet", "village", "town"]) {
      assertEveryoneHoused(
        brief.validate({ ...brief.defaults(theme, 424242), scale }, ctx),
        `defaults(${theme})/${scale}`,
        [1, 424242],
        2,
      );
    }
  }
}

// 64. A FRINGE RESIDENT IS NOT HOUSED IN THE SETTLEMENT, and that is not a gap.
// They live in the wilds — no dwelling, no bed, no lot — so the completeness
// invariant above has to be scoped to who the settlement actually owes a roof,
// and this is the case that says so out loud.
{
  const sealed = brief.validate(
    {
      scale: "hamlet",
      name: "Edgewood",
      places: [{ kind: "wilds", name: "The Reach" }],
      cast: [
        { name: "Sten", role: "smith", kind: "maker", tint: "amber", home: "Edgewood", household: 1 },
        { name: "Tam", role: "farmer", kind: "grower", tint: "green", home: "Edgewood", household: 2 },
        { name: "Cass", role: "cooper", kind: "folk", tint: "rose", home: "Edgewood", household: 3 },
        { name: "Wyn", role: "hermit", kind: "wanderer", tint: "teal", home: "Edgewood", household: 4, standing: "fringe" },
      ],
    },
    ctx,
  );
  assert.equal(sealed.cast.find((c) => c.name === "Wyn").standing, "fringe", "the outsider seals as fringe");
  // The settlement's own people are all housed — so the fringe exemption below
  // is an exemption, not the reason the case passes.
  assertEveryoneHoused(sealed, "fringe-hamlet");
  const woodsId = Object.entries(sealed._ids.zones).find(([, n]) => n === "The Reach")?.[0];
  for (const seed of [1, 3, 11]) {
    const w = world.build(seed, "cozy-village", sealed);
    const sim = new loadedPF.Sim(w);
    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    const wyn = w.zones[woodsId].npcs.find((npc) => npc.name === "Wyn");
    assert.ok(wyn, `seed ${seed}: the fringe hermit spends the night out in the wilds`);
    assert.equal(wyn._sched.home, null, `seed ${seed}: with no dwelling handle at all`);
    assert.ok(
      !Object.values(w.zones).some((zone) => zone.name === "Wyn's home"),
      `seed ${seed}: and no house is built for someone who does not live in the settlement`,
    );
  }
}

// ── Living quarters in a building the brief NAMED (0.8.0) ────────────────────
// The complaint this answers: `home` naming a place is the sanctioned way for a
// brief to say "this person lives here" — it is how a sanctuary's keeper has
// always worked and it is the escape hatch for a lord living in a keep — but the
// compiler laid sleeping only in the buildings it minted ITSELF. So the chaplain
// stood on the bare floor of her own church at midnight and the alewife on the
// floor of her own tap room, in the maintainer's own playtest seed.

/** The reported world: Bellwether, village, seed 80021. A chaplain homed at the
 *  sanctuary, an alewife homed at the inn, a smith and a weaver at the root. */
const bellwetherBrief = (overrides = {}) => ({
  scale: "village",
  name: "Bellwether",
  places: [
    { kind: "sanctuary", name: "St Brannock's" },
    { kind: "gathering", name: "The Ploughshare" },
  ],
  cast: [
    { name: "Ivy", role: "chaplain", kind: "elder", tint: "rose", home: "St Brannock's", household: 1 },
    { name: "Bett", role: "alewife", kind: "host", tint: "amber", home: "The Ploughshare", household: 2 },
    { name: "Tam", role: "smith", kind: "maker", tint: "green", home: "Bellwether", household: 3 },
    { name: "Nan", role: "weaver", kind: "folk", tint: "blue", home: "Bellwether", household: 4 },
  ],
  ...overrides,
});

// 65. A RESIDENT HOMED AT A NAMED PLACE SLEEPS IN IT. The keeper in her own
// church and the alewife over her own tap room, both on a bed at 23:00, in the
// seed the report named and in others.
{
  const sealed = brief.validate(bellwetherBrief(), ctx);
  // Non-vacuous: the two of them really are homed at places and not at the root,
  // which is the whole shape under test.
  const homeOf = (name) => sealed.cast.find((c) => c.name === name).home;
  assert.equal(homeOf("Ivy"), "St Brannock's", "the chaplain is homed at the church");
  assert.equal(homeOf("Bett"), "The Ploughshare", "the alewife is homed at the inn");
  for (const seed of [80021, 1, 3, 424242]) {
    const w = world.build(seed, "cozy-village", sealed);
    checkWorld(w, sealed, `bellwether seed ${seed}`);
    const church = findZone(w, "St Brannock's");
    const inn = findZone(w, "The Ploughshare");
    assert.ok(church && inn, `seed ${seed}: both named buildings compiled`);
    // They keep their World Maps row: a named place is a destination, and living
    // quarters inside it change nothing about that.
    assert.equal(church.mapExport, true, `seed ${seed}: the church is still a map destination`);
    assert.equal(inn.mapExport, true, `seed ${seed}: and so is the inn`);

    const sim = new loadedPF.Sim(w);
    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    for (const [name, zone] of [
      ["Ivy", church],
      ["Bett", inn],
    ]) {
      const npc = zone.npcs.find((n) => n.name === name);
      assert.ok(npc, `seed ${seed}: ${name} is inside ${zone.name} at 23:00`);
      assert.ok(
        SLEEPS_ON.has(zone.object[zone.w * npc.y + npc.x]),
        `seed ${seed}: ${name} is on a bed in ${zone.name}, not its bare floor (${npc.x},${npc.y})`,
      );
      assert.ok(
        zone.rooms.some(
          (room) => room.quarters && npc.x >= room.x0 && npc.x <= room.x1 && npc.y >= room.y0 && npc.y <= room.y1,
        ),
        `seed ${seed}: ${name} sleeps in the building's own quarters, behind a door`,
      );
    }
    // And the two at the root are housed exactly as before.
    for (const [name, zoneName] of [
      ["Tam", "Tam's shop"],
      ["Nan", "Nan's home"],
    ]) {
      const zone = findZone(w, zoneName);
      const npc = zone?.npcs.find((n) => n.name === name);
      assert.ok(npc, `seed ${seed}: ${name} is home in ${zoneName}`);
      assert.ok(SLEEPS_ON.has(zone.object[zone.w * npc.y + npc.x]), `seed ${seed}: ${name} is in a bed`);
    }
  }
  // A building the brief homes NOBODY in grows nothing: the quarters are opt-in,
  // so every world that never used this compiles exactly the tiles it always did.
  const empty = brief.validate(
    bellwetherBrief({
      cast: bellwetherBrief().cast.map((member) => ({ ...member, home: "Bellwether" })),
    }),
    ctx,
  );
  for (const seed of [80021, 1]) {
    const w = world.build(seed, "cozy-village", empty);
    const church = findZone(w, "St Brannock's");
    assert.equal(church.h, 14, `seed ${seed}: a church nobody lives in keeps its own height (${church.h})`);
    assert.equal(church.rooms.length, 0, `seed ${seed}: and partitions nothing`);
  }
}

// 65b. A NAMED HOME THE SETTLEMENT HAD NO ROOM FOR. An outpost's rows fit two
// buildings; this brief names two places AND has two root households, so one
// place is dropped (the facade guard — a named room with no door strands whoever
// lives in it). The resident homed at the dropped one lives in a building that
// does not exist, so the town owes them a roof like anyone else. Before this they
// spent the night on the plaza in a settlement they are a resident of.
{
  const sealed = brief.validate(bellwetherBrief({ scale: "outpost" }), ctx);
  for (const seed of [80021, 1, 3, 424242]) {
    const w = world.build(seed, "cozy-village", sealed);
    checkWorld(w, sealed, `dropped-home seed ${seed}`);
    // Non-vacuous: a place really was dropped, and it really is the one Bett was
    // homed at. If the outpost ever fits both, this fixture stops testing the
    // fallback and should be re-shaped rather than relaxed.
    const named = ["St Brannock's", "The Ploughshare"].filter((name) => findZone(w, name));
    assert.equal(named.length, 1, `seed ${seed}: exactly one named place fits an outpost (${named.join()})`);
    assert.ok(!findZone(w, "The Ploughshare"), `seed ${seed}: the inn is the one dropped`);
    const sim = new loadedPF.Sim(w);
    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    for (const name of ["Ivy", "Bett", "Tam", "Nan"]) {
      const hit = Object.values(w.zones)
        .map((zone) => ({ zone, npc: zone.npcs.find((n) => n.name === name) }))
        .find((entry) => entry.npc);
      assert.ok(hit, `seed ${seed}: ${name} is somewhere in the world`);
      assert.ok(
        SLEEPS_ON.has(hit.zone.object[hit.zone.w * hit.npc.y + hit.npc.x]),
        `seed ${seed}: ${name} is on a bed at 23:00, not the plaza (${hit.zone.id} ${hit.npc.x},${hit.npc.y})`,
      );
    }
  }
}

// 66. THE KEEPER'S BED IS NOT A GUEST BERTH. An inn rents rooms; the woman who
// runs it is not a lodger. The two lists are carved from different bands of the
// building and never intersect — a keeper bedded down in a rented room is wrong,
// and a traveller handed the keeper's bed is worse.
{
  const innkeepBrief = (guests) => ({
    scale: "village",
    name: "Waymeet",
    places: [{ kind: "gathering", name: "The Ploughshare" }],
    cast: [
      { name: "Bett", role: "alewife", kind: "host", tint: "amber", home: "The Ploughshare", household: 1 },
      { name: "Pip", role: "pot-boy", kind: "child", tint: "green", home: "The Ploughshare", household: 1 },
      { name: "Nan", role: "weaver", kind: "folk", tint: "blue", home: "Waymeet", household: 2 },
      { name: "Tam", role: "smith", kind: "maker", tint: "teal", home: "Waymeet", household: 3 },
      ...Array.from({ length: guests }, (_, i) => ({
        name: `T${i}`,
        role: "drover",
        kind: "folk",
        tint: ["rose", "violet", "grey", "red"][i % 4],
        home: "Waymeet",
        household: 4,
        standing: "transient",
      })),
    ],
  });
  for (const guests of [1, 4]) {
    const sealed = brief.validate(innkeepBrief(guests), ctx);
    assert.equal(
      sealed.cast.filter((c) => (c.standing ?? "resident") === "transient").length,
      guests,
      `${guests} guests sealed — a fixture with none would make the overlap check vacuous`,
    );
    for (const seed of [1, 3, 11, 424242]) {
      const w = world.build(seed, "cozy-village", sealed);
      checkWorld(w, sealed, `innkeep(${guests}) seed ${seed}`);
      const inn = findZone(w, "The Ploughshare");
      assert.ok(inn, `seed ${seed}: the inn compiled`);
      // Non-vacuous both ways: there are berths AND there are quarters. The two
      // lists were always carved from different bands; with the wing upstairs
      // (0.8.0 floors) they are on different FLOORS, so every key here carries
      // the zone — a tile number alone would now match across a staircase.
      assert.ok(inn.beds.length >= 3, `seed ${seed}: the guest wing has berths (${inn.beds.length})`);
      assert.equal(inn.homeBeds.length, 2, `seed ${seed}: and the keeper's household has beds of its own`);
      const key = (bed) => `${bed.zoneId}:${bed.x},${bed.y}`;
      const berth = new Set(inn.beds.map(key));
      for (const bed of inn.homeBeds) {
        assert.ok(!berth.has(key(bed)), `seed ${seed}: the keeper's bed at ${key(bed)} is also being rented out`);
      }
      // And in the handles: the keeper sleeps in the quarters, every guest in the
      // wing, nobody in anybody else's.
      const sim = new loadedPF.Sim(w);
      sim.clockMin = 23 * 60;
      sim.resolveSchedules();
      const home = new Set(inn.homeBeds.map(key));
      for (const name of ["Bett", "Pip"]) {
        const npc = inn.npcs.find((n) => n.name === name);
        assert.ok(npc, `seed ${seed}: ${name} sleeps at the inn they live in — downstairs, behind the tap room`);
        assert.ok(home.has(`${inn.id}:${npc.x},${npc.y}`), `seed ${seed}: ${name} is in their OWN bed, not a let room`);
      }
      const lodgers = underRoof(w, inn.id).filter(({ npc }) => npc.name.startsWith("T"));
      assert.equal(lodgers.length, guests, `seed ${seed}: all ${guests} guests are somewhere in the inn`);
      for (const { zone, npc } of lodgers) {
        assert.ok(
          !home.has(`${zone.id}:${npc.x},${npc.y}`),
          `seed ${seed}: guest ${npc.name} was put in the keeper's bed (${npc.x},${npc.y})`,
        );
        const handle = npc._sched.home;
        if (handle && handle.wander.x0 === handle.wander.x1 && handle.wander.y0 === handle.wander.y1) {
          assert.ok(
            berth.has(`${handle.zoneId}:${handle.wander.x0},${handle.wander.y0}`),
            `seed ${seed}: guest ${npc.name} was dealt a bed that is not a guest berth`,
          );
        }
      }
      // Guest berths are still sized by the settlement, not by who lives in it.
      assert.equal(inn.beds.length, 6, `seed ${seed}: a modest village inn still offers six berths`);
    }
  }

  // The other half of the same rule: an INN rents rooms, a HOUSE does not. Only
  // a gathering lays berths, so a `dwelling` place the brief names sleeps its own
  // people and offers nothing — otherwise it would lay a whole inn's worth of
  // beds across the very rows its household's quarters are carved from.
  const housed = brief.validate(
    {
      scale: "village",
      name: "Oldgate",
      places: [{ kind: "dwelling", name: "The Old House" }],
      cast: [
        { name: "Gran", role: "elder", kind: "folk", tint: "rose", home: "The Old House", household: 1 },
        { name: "Pip", role: "ward", kind: "child", tint: "green", home: "The Old House", household: 1 },
        { name: "Nel", role: "ward", kind: "child", tint: "amber", home: "The Old House", household: 1 },
        { name: "Nan", role: "weaver", kind: "folk", tint: "blue", home: "Oldgate", household: 2 },
      ],
    },
    ctx,
  );
  assert.equal(
    housed.places.find((place) => place.kind === "dwelling")?.name,
    "The Old House",
    "the named house survives validation — a dropped place would make this vacuous",
  );
  for (const seed of [1, 3, 424242]) {
    const w = world.build(seed, "cozy-village", housed);
    checkWorld(w, housed, `named-house seed ${seed}`);
    const house = findZone(w, "The Old House");
    assert.ok(house, `seed ${seed}: the named house compiled`);
    assert.equal(house.beds.length, 0, `seed ${seed}: a house lets no rooms (${house.beds.length} berths)`);
    assert.equal(house.homeBeds.length, 3, `seed ${seed}: and sleeps its own three`);
    assert.ok(
      house.rooms.every((room) => room.quarters),
      `seed ${seed}: every room in it belongs to the household`,
    );
    const sim = new loadedPF.Sim(w);
    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    const taken = new Set();
    for (const name of ["Gran", "Pip", "Nel"]) {
      const npc = house.npcs.find((n) => n.name === name);
      assert.ok(npc, `seed ${seed}: ${name} is home at 23:00`);
      assert.ok(SLEEPS_ON.has(house.object[house.w * npc.y + npc.x]), `seed ${seed}: ${name} is in a bed`);
      assert.ok(!taken.has(`${npc.x},${npc.y}`), `seed ${seed}: ${name} shares a tile with a housemate`);
      taken.add(`${npc.x},${npc.y}`);
    }
  }
}

// 67. A HOUSEHOLD HOMED AT A PLACE GETS THE USUAL ROOMS. Not one bed each in a
// row: bedrooms, and bunks once a room has to take more than two — the same
// density rule a family in a house gets, because it is the same call — except
// for the LORD, who gets a room of his own first (case 68). Six and three are the
// two sides of the density line for the rooms after his, so neither half can go
// vacuous.
{
  const keepBrief = (size, kind = "leader") => ({
    scale: "village",
    name: "Marchward",
    places: [{ kind: "hall", name: "The Keep" }],
    cast: [
      ...Array.from({ length: size }, (_, i) => ({
        name: `Kin${i}`,
        role: i ? "ward" : "lord",
        kind: i ? "child" : kind,
        tint: ["blue", "green", "amber", "rose", "teal", "violet"][i % 6],
        home: "The Keep",
        household: 1,
      })),
      { name: "Nan", role: "weaver", kind: "folk", tint: "grey", home: "Marchward", household: 2 },
      { name: "Tam", role: "carter", kind: "folk", tint: "red", home: "Marchward", household: 3 },
    ],
  });
  for (const seed of [1, 3, 11]) {
    const built = (size, kind) => {
      const sealed = brief.validate(keepBrief(size, kind), ctx);
      assert.equal(
        sealed.cast.filter((c) => c.home === "The Keep").length,
        size,
        `all ${size} stay homed at the keep — a split would test a different building`,
      );
      const w = world.build(seed, "cozy-village", sealed);
      checkWorld(w, sealed, `keep(${size}) seed ${seed}`);
      const keep = findZone(w, "The Keep");
      assert.ok(keep, `seed ${seed}: the keep compiled`);
      return { w, keep, sealed };
    };

    const big = built(6);
    const quarters = big.keep.rooms.filter((room) => room.quarters);
    const shared = quarters.filter((room) => !room.private);
    assert.equal(quarters.length, 3, `seed ${seed}: the lord's room and two more (${quarters.length})`);
    assert.equal(shared.length, 2, `seed ${seed}: five wards want two rooms between them (${shared.length})`);
    assert.equal(big.keep.homeBeds.length, 6, `seed ${seed}: six sleepers, six places`);
    const tileAt = (zone, bed) => zone.object[zone.w * bed.y + bed.x];
    assert.ok(
      shared.some((room) => room.beds.every((bed) => tileAt(big.keep, bed) === "bunk")),
      `seed ${seed}: three to a room is dense, so that room bunks`,
    );
    // Real rooms, in the tiles: shut a quarters door and its beds leave the map.
    for (const room of quarters) {
      const shut = floodFill(big.keep, big.keep.spawn, new Set([`${room.doorX},${room.y1 + 1}`]));
      for (const bed of room.beds) {
        assert.ok(
          !shut.has(`${bed.x},${bed.y}`),
          `seed ${seed}: closing the quarters door leaves ${bed.x},${bed.y} open — the room has no walls`,
        );
      }
    }
    // And the hall is still a hall underneath them.
    assert.ok(big.keep.object.includes("table"), `seed ${seed}: the great table survives the quarters above it`);

    // Three is the other side of the density line: the lord's room plus one that
    // sleeps two, and nothing in the building bunks.
    const small = built(3);
    assert.equal(small.keep.homeBeds.length, 3, `seed ${seed}: three sleepers, three places`);
    assert.equal(
      small.keep.rooms.filter((room) => room.quarters).length,
      2,
      `seed ${seed}: the lord's room and one for the pair`,
    );
    assert.ok(
      small.keep.homeBeds.every((bed) => small.keep.object[small.keep.w * bed.y + bed.x] === "bed"),
      `seed ${seed}: two to a room is not dense, so no bunk appears`,
    );

    // NO OWNER, no private room: six folk homed at a hall nobody runs sleep by the
    // ordinary rules, exactly as they did before. The counterpart that keeps the
    // private room from being "whoever is listed first".
    const unowned = built(6, "folk");
    const unownedQuarters = unowned.keep.rooms.filter((room) => room.quarters);
    assert.ok(
      unownedQuarters.every((room) => !room.private),
      `seed ${seed}: a building nobody runs reserves nothing`,
    );
    assert.equal(unownedQuarters.length, 2, `seed ${seed}: six share two rooms (${unownedQuarters.length})`);
    assert.equal(unowned.keep.homeBeds.length, 6, `seed ${seed}: and everyone still has a place`);
    assert.ok(
      unowned.keep.homeBeds.every((bed) => unowned.keep.object[unowned.keep.w * bed.y + bed.x] === "bunk"),
      `seed ${seed}: three to a room, both rooms bunked, as before`,
    );

    // Everybody is actually in them at 23:00, one tile each.
    const sim = new loadedPF.Sim(big.w);
    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    const taken = new Set();
    for (let i = 0; i < 6; i++) {
      const npc = big.keep.npcs.find((n) => n.name === `Kin${i}`);
      assert.ok(npc, `seed ${seed}: Kin${i} is home in the keep at 23:00`);
      assert.ok(SLEEPS_ON.has(big.keep.object[big.keep.w * npc.y + npc.x]), `seed ${seed}: Kin${i} is in a bed`);
      assert.ok(!taken.has(`${npc.x},${npc.y}`), `seed ${seed}: Kin${i} shares a tile with a housemate`);
      taken.add(`${npc.x},${npc.y}`);
    }
  }
}

// 68. THE OWNER GETS A ROOM OF THEIR OWN. A building that houses the person who
// runs it owes them a door of their own: an innkeeper asleep in a room she rents
// out reads as a lodger in her own inn, and an innkeeper bunked in with her staff
// reads as a dormitory. Six was the shape that failed — the keeper was simply the
// first bed in a shared bunked room — and two only ever looked right by luck.
//
// Single occupancy is asserted at EVERY daypart, not just at 23:00: a room that
// is private at midnight and shared at noon is not private.
{
  const anchorBrief = (size, guests) => ({
    scale: "town",
    prosperity: "thriving",
    name: "Harbour",
    places: [{ kind: "gathering", name: "The Anchor" }],
    cast: [
      { name: "Keep", role: "innkeep", kind: "host", tint: "amber", home: "The Anchor", household: 1 },
      ...Array.from({ length: size - 1 }, (_, i) => ({
        name: `K${i}`,
        role: "hand",
        kind: "folk",
        tint: ["green", "blue", "rose", "teal", "violet"][i % 5],
        home: "The Anchor",
        household: 1,
      })),
      ...Array.from({ length: guests }, (_, i) => ({
        name: `T${i}`,
        role: "drover",
        kind: "folk",
        tint: ["grey", "red"][i % 2],
        home: "Harbour",
        household: 2,
        standing: "transient",
      })),
      { name: "Nan", role: "weaver", kind: "folk", tint: "grey", home: "Harbour", household: 3 },
      { name: "Tam", role: "carter", kind: "folk", tint: "red", home: "Harbour", household: 4 },
    ],
  });
  for (const size of [1, 2, 3, 4, 5, 6]) {
    const guests = size <= 4 ? 2 : 0; // castMax is 10; keep the fixture sealed untouched
    const sealed = brief.validate(anchorBrief(size, guests), ctx);
    // Non-vacuous: the household really is `size` people under one roof, and the
    // owner really is the one who runs the building rather than a lodger.
    assert.equal(
      sealed.cast.filter((c) => c.home === "The Anchor").length,
      size,
      `${size}: the whole household stays homed at the inn`,
    );
    assert.equal(sealed.cast.find((c) => c.name === "Keep").kind, "host", `${size}: the keeper keeps the inn`);
    for (const seed of [1, 11, 424242]) {
      const w = world.build(seed, "cozy-village", sealed);
      checkWorld(w, sealed, `anchor(${size}) seed ${seed}`);
      const inn = findZone(w, "The Anchor");
      assert.ok(inn, `${size} seed ${seed}: the inn compiled`);
      const own = inn.rooms.find((room) => room.private);
      assert.ok(own, `${size} seed ${seed}: the keeper has a room of her own`);
      assert.equal(own.beds.length, 1, `${size} seed ${seed}: single occupancy (${own.beds.length} beds in it)`);
      assert.equal(
        inn.object[inn.w * own.beds[0].y + own.beds[0].x],
        "bed",
        `${size} seed ${seed}: a bed, never a bunk — a private room is not a berth in a stack`,
      );
      // Everyone still has a sleeping place, private room and all.
      assert.equal(inn.homeBeds.length, size, `${size} seed ${seed}: ${size} sleepers, ${inn.homeBeds.length} places`);
      assert.equal(
        new Set(inn.homeBeds.map((bed) => `${bed.x},${bed.y}`)).size,
        size,
        `${size} seed ${seed}: no place is dealt twice`,
      );
      // It is HERS: the owner's night handle is that bed, and it is not a berth.
      // The quarters are downstairs and the let rooms are up (0.8.0 floors), so
      // the keys carry a zone — bare tile numbers would now collide across the
      // staircase and this case would read as a clash that is not one.
      const berth = new Set(inn.beds.map((bed) => `${bed.zoneId}:${bed.x},${bed.y}`));
      const ownTile = `${own.beds[0].x},${own.beds[0].y}`;
      assert.ok(!berth.has(`${inn.id}:${ownTile}`), `${size} seed ${seed}: the keeper's own bed is also being let out`);
      const keeper = Object.values(w.zones)
        .flatMap((zone) => zone.npcs)
        .find((npc) => npc.name === "Keep");
      assert.equal(
        `${keeper._sched.home.zoneId}:${keeper._sched.home.wander.x0},${keeper._sched.home.wander.y0}`,
        `${inn.id}:${ownTile}`,
        `${size} seed ${seed}: the keeper is sent to her own room, not to a let one`,
      );

      // Single occupancy, all day: nobody else is ever inside that room.
      const sim = new loadedPF.Sim(w);
      const inside = (npc) => npc.x >= own.x0 && npc.x <= own.x1 && npc.y >= own.y0 && npc.y <= own.y1;
      let sleptThere = 0;
      for (const clock of [6 * 60, 12 * 60, 19 * 60, 23 * 60]) {
        sim.clockMin = clock;
        sim.resolveSchedules();
        const occupants = Object.values(w.zones)
          .flatMap((zone) => (zone === inn ? zone.npcs : []))
          .filter(inside);
        assert.ok(
          occupants.length <= 1,
          `${size} seed ${seed} @${clock / 60}: ${occupants.length} people in the keeper's room (${occupants.map((n) => n.name).join()})`,
        );
        for (const npc of occupants) {
          assert.equal(npc.name, "Keep", `${size} seed ${seed} @${clock / 60}: ${npc.name} is in the keeper's room`);
        }
        if (occupants.length === 1) sleptThere++;
      }
      // Non-vacuous: "nobody else is ever in there" would pass on a room the
      // keeper never enters either.
      assert.ok(sleptThere > 0, `${size} seed ${seed}: the keeper actually uses the room she was given`);

      // The rest of the household sleep in the rooms after hers, one tile each.
      sim.clockMin = 23 * 60;
      sim.resolveSchedules();
      const taken = new Set();
      for (let i = 0; i < size - 1; i++) {
        const npc = inn.npcs.find((n) => n.name === `K${i}`);
        assert.ok(npc, `${size} seed ${seed}: K${i} sleeps at the inn they live in`);
        assert.ok(SLEEPS_ON.has(inn.object[inn.w * npc.y + npc.x]), `${size} seed ${seed}: K${i} is in a bed`);
        assert.ok(!inside(npc), `${size} seed ${seed}: K${i} is bunked in the keeper's own room`);
        assert.ok(!taken.has(`${npc.x},${npc.y}`), `${size} seed ${seed}: K${i} shares a tile`);
        taken.add(`${npc.x},${npc.y}`);
      }
      // And no traveller is ever put in it.
      for (const npc of inn.npcs.filter((n) => n.name.startsWith("T"))) {
        assert.ok(!inside(npc), `${size} seed ${seed}: guest ${npc.name} was put in the keeper's own room`);
      }
    }
  }

  // The room is the OWNER'S, not the first-listed resident's. Same household,
  // same size, the keeper written LAST in the cast — without this the rule could
  // be "whoever comes first in the array" and nothing here would notice.
  {
    const late = anchorBrief(4, 0);
    const keeper = late.cast.find((member) => member.name === "Keep");
    late.cast = [...late.cast.filter((member) => member !== keeper), keeper];
    const sealed = brief.validate(late, ctx);
    assert.notEqual(
      sealed.cast.filter((c) => c.home === "The Anchor")[0].name,
      "Keep",
      "the keeper really is not the first of her household in the cast",
    );
    for (const seed of [1, 11, 424242]) {
      const w = world.build(seed, "cozy-village", sealed);
      checkWorld(w, sealed, `anchor-late seed ${seed}`);
      const inn = findZone(w, "The Anchor");
      const own = inn.rooms.find((room) => room.private);
      assert.ok(own, `seed ${seed}: the keeper still gets a room of her own`);
      const sim = new loadedPF.Sim(w);
      sim.clockMin = 23 * 60;
      sim.resolveSchedules();
      const inRoom = inn.npcs.filter((n) => n.x >= own.x0 && n.x <= own.x1 && n.y >= own.y0 && n.y <= own.y1);
      assert.deepEqual(
        inRoom.map((n) => n.name),
        ["Keep"],
        `seed ${seed}: the private room belongs to whoever RUNS the inn (${inRoom.map((n) => n.name).join()})`,
      );
    }
  }

  // The documented fallback, exercised rather than asserted from the comment:
  // ten people homed at one inn cannot have both a private room and a bed each,
  // so the private room is the thing that gives way — never a sleeper.
  {
    const crowd = {
      scale: "town",
      prosperity: "thriving",
      name: "Harbour",
      places: [{ kind: "gathering", name: "The Anchor" }],
      cast: [
        { name: "Keep", role: "innkeep", kind: "host", tint: "amber", home: "The Anchor", household: 1 },
        ...Array.from({ length: 9 }, (_, i) => ({
          name: `K${i}`,
          role: "hand",
          kind: "folk",
          tint: ["green", "blue", "rose", "teal", "violet", "grey"][i % 6],
          home: "The Anchor",
          household: i < 5 ? 1 : 2,
        })),
      ],
    };
    const sealed = brief.validate(crowd, ctx);
    const living = sealed.cast.filter((c) => c.home === "The Anchor");
    assert.equal(living.length, 10, `all ten are homed at the inn (${living.length})`);
    for (const seed of [1, 11, 424242]) {
      const w = world.build(seed, "cozy-village", sealed);
      checkWorld(w, sealed, `anchor-crowd seed ${seed}`);
      const inn = findZone(w, "The Anchor");
      assert.equal(inn.homeBeds.length, 10, `seed ${seed}: ten sleepers, ten places (${inn.homeBeds.length})`);
      assert.equal(
        new Set(inn.homeBeds.map((bed) => `${bed.x},${bed.y}`)).size,
        10,
        `seed ${seed}: and no place dealt twice`,
      );
      assert.ok(
        !inn.rooms.some((room) => room.private),
        `seed ${seed}: the private room gives way rather than a sleeper going without`,
      );
      const sim = new loadedPF.Sim(w);
      sim.clockMin = 23 * 60;
      sim.resolveSchedules();
      for (const member of living) {
        const npc = inn.npcs.find((n) => n.name === member.name);
        assert.ok(npc, `seed ${seed}: ${member.name} sleeps at the inn`);
        assert.ok(SLEEPS_ON.has(inn.object[inn.w * npc.y + npc.x]), `seed ${seed}: ${member.name} is in a bed`);
      }
    }
  }
}

// ── Floors: storeys, cellars and the bell tower (0.8.0) ──────────────────────
// A ROOM is a partition inside a zone; a FLOOR is a zone of its own, joined by a
// stair portal pair. The split is the whole design — a bedroom must never cost a
// zone, and a floor buys one in exchange for reusing the portal, reachability,
// save-restore and schedule machinery unchanged — so these cases test the two
// halves separately: that a floor really is geometry the player can walk into and
// out of, and that the GATE keeps the number of them down.

const STAIR_TILES = new Set(["stairsUp", "stairsDown"]);
/** Every stair tile in a zone, with the portal it fires. */
const stairsIn = (zone) => {
  const out = [];
  for (let y = 0; y < zone.h; y++) {
    for (let x = 0; x < zone.w; x++) {
      if (!STAIR_TILES.has(zone.object[zone.w * y + x])) continue;
      out.push({ x, y, tile: zone.object[zone.w * y + x], portal: zone.portals.find((p) => p.x === x && p.y === y) });
    }
  }
  return out;
};
/** Walk the player until a portal fires, or give up. Driven through the real Sim
 *  on purpose: a portal pair that never fires is exactly the bug a table read
 *  cannot see. */
const walkUntilCross = (sim, input) => {
  for (let tick = 0; tick < 200; tick++) {
    if (sim.step(1 / 60, input)?.zoneChanged) return sim.zoneId;
  }
  return null;
};
const playerTile = (sim) => `${Math.floor(sim.x / loadedPF.TILE)},${Math.floor(sim.y / loadedPF.TILE)}`;

// 69. A BUILDING WITH AN UPPER FLOOR. The floor exists, it is a zone, it is
// stamped out of the World Maps export, and the player can walk up the stairs and
// back down them.
{
  const sealed = brief.validate(bedsBrief(), ctx);
  for (const seed of [1, 3, 11, 424242]) {
    const w = world.build(seed, "cozy-village", sealed);
    checkWorld(w, sealed, `upper-floor seed ${seed}`);
    const inn = findZone(w, "The Kettle");
    assert.ok(inn, `seed ${seed}: the inn compiled`);
    const up = w.zones[`${inn.id}u`];
    assert.ok(up, `seed ${seed}: and grew a storey (${inn.id}u)`);
    assert.equal(up.name, "The Kettle, upstairs", `seed ${seed}: named for the building under it`);
    assert.equal(up.mapExport, false, `seed ${seed}: a floor is a room inside one location, never a row of its own`);
    // Non-vacuous: the storey is where the guest rooms actually went.
    assert.ok(up.beds.length >= 3, `seed ${seed}: the guest wing is up here (${up.beds.length} berths)`);
    assert.ok(
      inn.beds.length > 0 && inn.beds.every((bed) => bed.zoneId === up.id),
      `seed ${seed}: and every berth the building offers names that floor`,
    );

    // The stairs are a MATCHED PAIR, in the tiles as well as in the portal table.
    // A portal with no tile under it is an invisible trapdoor; a tile with no
    // portal is a painted step that goes nowhere.
    const below = stairsIn(inn).filter((step) => step.tile === "stairsUp");
    assert.equal(below.length, 1, `seed ${seed}: one flight up out of the tap room (${below.length})`);
    assert.equal(below[0].portal?.toZone, up.id, `seed ${seed}: and it is a portal to the storey`);
    const above = stairsIn(up).filter((step) => step.tile === "stairsDown");
    assert.equal(above.length, 1, `seed ${seed}: one flight back down (${above.length})`);
    assert.equal(above[0].portal?.toZone, inn.id, `seed ${seed}: which lands in the building it came from`);
    for (const zone of [inn, up]) {
      for (const step of stairsIn(zone)) {
        assert.ok(step.portal, `seed ${seed}: the step at ${zone.id} ${step.x},${step.y} fires nothing`);
        assert.equal(zone.solid[zone.w * step.y + step.x], 0, `seed ${seed}: a step the player cannot stand on`);
      }
    }

    // CLIMB IT. Stand on the tile inside the front door, walk west onto the step,
    // and the Sim's own portal handling does the rest.
    const sim = new loadedPF.Sim(w);
    sim.teleport(inn.id, inn.spawn.x, inn.spawn.y);
    assert.equal(walkUntilCross(sim, { left: true }), up.id, `seed ${seed}: walking west of the door goes upstairs`);
    // The landing is not the stairhead: arriving on it would fire the portal
    // again and bounce the player straight back down.
    assert.notEqual(playerTile(sim), `${above[0].x},${above[0].y}`, `seed ${seed}: the player lands beside the step`);
    assert.equal(playerTile(sim), `${up.spawn.x},${up.spawn.y}`, `seed ${seed}: on the storey's own landing`);
    // Back down: the storey's step is directly south of the landing.
    assert.equal(walkUntilCross(sim, { down: true }), inn.id, `seed ${seed}: and walking south comes back down`);
    assert.equal(playerTile(sim), `${inn.spawn.x},${inn.spawn.y}`, `seed ${seed}: landing back beside the front door`);
  }
}

// 70. A SLEEPER WHOSE BED IS UPSTAIRS IS UPSTAIRS AT NIGHT. Five under one roof
// is a large household, so the bedrooms are a flight up — and the schedule
// resolver needed no new code for it, because a floor is a zone and going to bed
// is the cross-zone splice it always was. (NPCs TELEPORT across a daypart
// boundary; pathing is deferred to roadmap 12, so a sleeper simply appears in
// their room rather than climbing the stairs.)
{
  const sealed = brief.validate(houseBrief("Upfold", 5, "folk"), ctx);
  for (const seed of [1, 3, 11, 424242]) {
    const w = world.build(seed, "cozy-village", sealed);
    checkWorld(w, sealed, `upstairs-sleeper seed ${seed}`);
    const home = findZone(w, "Kin0's home");
    const up = w.zones[`${home.id}u`];
    assert.ok(up, `seed ${seed}: a five-person household sleeps upstairs`);
    // Non-vacuous both ways: nothing to sleep on downstairs, everything up.
    assert.equal(
      home.object.filter((tile) => SLEEPS_ON.has(tile)).length,
      0,
      `seed ${seed}: there is nothing to sleep on downstairs`,
    );
    assert.ok(up.object.filter((tile) => SLEEPS_ON.has(tile)).length >= 5, `seed ${seed}: the beds are up here`);
    // And the rows the bedrooms left behind are part of the room now rather than
    // a hole in it: a house with a staircase has a bigger ground floor, not a
    // blank slab where the wing used to be. Rows 2-4 are exactly the band
    // layoutSleeping would have partitioned.
    const bandFittings = [];
    for (let y = 2; y <= 4; y++) {
      // The shell's own side columns live in `object` too, so the scan stops
      // inside them — a slice of whole rows would find the walls and pass on an
      // empty room.
      for (let x = 1; x <= home.w - 2; x++) if (home.object[home.w * y + x]) bandFittings.push(`${x},${y}`);
    }
    assert.ok(
      bandFittings.length >= 4,
      `seed ${seed}: the band the bedrooms vacated is furnished, not left empty (${bandFittings.length} tiles)`,
    );

    const sim = new loadedPF.Sim(w);
    const names = ["Kin0", "Kin1", "Kin2", "Kin3", "Kin4"];
    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    const taken = new Set();
    for (const name of names) {
      const npc = up.npcs.find((n) => n.name === name);
      assert.ok(npc, `seed ${seed}: ${name} is upstairs at 23:00`);
      assert.ok(SLEEPS_ON.has(standingOn(up, npc)), `seed ${seed}: ${name} is in a bed up there (${npc.x},${npc.y})`);
      assert.ok(!taken.has(`${npc.x},${npc.y}`), `seed ${seed}: ${name} shares a berth`);
      taken.add(`${npc.x},${npc.y}`);
    }
    // …and out of the bedrooms by day. Not merely "not upstairs": they are out in
    // the settlement, which is where a resident's day handle has always sent them.
    sim.clockMin = 12 * 60;
    sim.resolveSchedules();
    assert.equal(up.npcs.length, 0, `seed ${seed}: the bedrooms are empty by day (${up.npcs.length} still up)`);
    for (const name of names) {
      const found = Object.values(w.zones).find((zone) => zone.npcs.some((n) => n.name === name));
      assert.ok(found, `seed ${seed}: ${name} is somewhere in the world by day`);
      assert.notEqual(found.id, up.id, `seed ${seed}: ${name} is not still in bed at noon`);
    }
    // The round trip is repeatable: nobody is lost or duplicated by the splice.
    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    for (const name of names) {
      const copies = Object.values(w.zones).reduce((n, zone) => n + zone.npcs.filter((x) => x.name === name).length, 0);
      assert.equal(copies, 1, `seed ${seed}: ${name} exists in exactly one zone after two crossings`);
    }
  }
}

// 70b. THE OTHER SIDE OF THE GATE. A cottage keeps its bedrooms on the ground
// floor — which is the whole reason zone count does not run away, so it is
// asserted rather than assumed.
{
  for (const size of [1, 2, 3]) {
    const sealed = brief.validate(houseBrief(`Small${size}`, size, "folk"), ctx);
    for (const seed of [1, 11, 424242]) {
      const w = world.build(seed, "cozy-village", sealed);
      const home = findZone(w, "Kin0's home");
      assert.ok(home, `${size} seed ${seed}: the cottage compiled`);
      assert.equal(w.zones[`${home.id}u`], undefined, `${size} seed ${seed}: a cottage of ${size} grows no storey`);
      assert.equal(home.beds.length, size, `${size} seed ${seed}: and sleeps its people downstairs`);
      assert.ok(
        home.beds.every((bed) => bed.zoneId === home.id),
        `${size} seed ${seed}: on this floor, in this zone`,
      );
    }
  }
  // FOUR is the line: two full bedrooms is where the band takes the whole north
  // wall and the ground floor is corridor past it.
  for (const seed of [1, 11, 424242]) {
    const under = world.build(seed, "cozy-village", brief.validate(houseBrief("Threefold", 3, "folk"), ctx));
    const over = world.build(seed, "cozy-village", brief.validate(houseBrief("Fourfold", 4, "folk"), ctx));
    assert.equal(
      under.zones[`${findZone(under, "Kin0's home").id}u`],
      undefined,
      `seed ${seed}: three keeps the ground floor`,
    );
    assert.ok(over.zones[`${findZone(over, "Kin0's home").id}u`], `seed ${seed}: four takes the stairs`);
  }
}

// 71. CELLARS, where the rule says and nowhere else. The workshop and the
// gathering always — both are buildings the whole settlement uses and the stock
// has to go somewhere. A house on a draw seeded by PROSPERITY: a cellar is stored
// surplus, so a struggling settlement digs none.
const cellarBrief = (prosperity) => ({
  scale: "town",
  prosperity,
  name: "Delve",
  places: [
    { kind: "workshop", name: "The Forge" },
    { kind: "gathering", name: "The Kettle" },
    { kind: "hall", name: "The Moot" },
  ],
  cast: [
    { name: "Ada", role: "reeve", kind: "leader", tint: "blue", home: "Delve", household: 1 },
    { name: "Perrin", role: "innkeep", kind: "host", tint: "orange", home: "The Kettle", household: 2 },
    { name: "Bram", role: "smith", kind: "maker", tint: "green", home: "The Forge", household: 3 },
    { name: "Cass", role: "cooper", kind: "folk", tint: "amber", home: "Delve", household: 4 },
    { name: "Dell", role: "carter", kind: "folk", tint: "rose", home: "Delve", household: 5 },
    { name: "Enna", role: "wright", kind: "folk", tint: "teal", home: "Delve", household: 6 },
  ],
});
{
  let thrivingHouseCellars = 0;
  for (const prosperity of ["struggling", "modest", "thriving"]) {
    const sealed = brief.validate(cellarBrief(prosperity), ctx);
    for (const seed of [1, 3, 11, 424242]) {
      const w = world.build(seed, "cozy-village", sealed);
      checkWorld(w, sealed, `cellars(${prosperity}) seed ${seed}`);
      const label = `${prosperity} seed ${seed}`;
      const dug = (name) => {
        const zone = findZone(w, name);
        return zone ? !!w.zones[`${zone.id}b`] : null;
      };
      // ALWAYS, at every prosperity — including struggling, where no house has one.
      assert.equal(dug("The Forge"), true, `${label}: the workshop always has an undercroft`);
      assert.equal(dug("The Kettle"), true, `${label}: and the gathering always has a cellar`);
      // NEVER: a hall is a duty station and nobody asked for a cellar under it.
      assert.equal(dug("The Moot"), false, `${label}: the hall digs nothing`);
      // Houses, by prosperity. Counted over the whole world so the case does not
      // depend on which household won which lot.
      const houses = Object.values(w.zones).filter((zone) => /^[hs]\d+$/.test(zone.id));
      assert.ok(houses.length >= 2, `${label}: the fixture built houses to ask about (${houses.length})`);
      const cellars = houses.filter((house) => w.zones[`${house.id}b`]).length;
      if (prosperity === "struggling") {
        assert.equal(cellars, 0, `${label}: a struggling settlement has no surplus to keep (${cellars} cellars)`);
      }
      if (prosperity === "thriving") thrivingHouseCellars += cellars;
      // Whatever was dug came from the SEED and not from the clock: a rebuild of
      // the same brief digs exactly the same cellars.
      const again = world.build(seed, "cozy-village", sealed);
      assert.deepEqual(
        Object.keys(again.zones)
          .filter((id) => id.endsWith("b"))
          .sort(),
        Object.keys(w.zones)
          .filter((id) => id.endsWith("b"))
          .sort(),
        `${label}: the same cellars every rebuild`,
      );
    }
  }
  // Non-vacuous the other way: the prosperity draw really does fire somewhere, or
  // "struggling digs none" would pass on a rule that never digs at all.
  assert.ok(thrivingHouseCellars > 0, `a thriving town digs house cellars too (${thrivingHouseCellars})`);

  // A cellar is STORES, and a room the player can walk about in rather than a
  // named void: the floor exists today mostly for what building and resource
  // management will put in it, but it has to be somewhere to put anything.
  const w = world.build(424242, "cozy-village", brief.validate(cellarBrief("thriving"), ctx));
  const forge = findZone(w, "The Forge");
  const under = w.zones[`${forge.id}b`];
  assert.equal(under.name, "The Forge cellar", "a cellar is named for the building over it");
  assert.equal(under.mapExport, false, "and is never a map destination");
  assert.ok(under.object.filter((tile) => tile === "shelf").length >= 4, "with stock down its walls");
  assert.ok(under.object.includes("counter"), "and a bench, because a forge's undercroft is worked in");
  const reached = floodFill(under, under.spawn);
  assert.ok(reached.size > 20, `the cellar is a room, not a corridor (${reached.size} tiles from the stairhead)`);
}

// 72. THE BELL TOWER. The showcase: the player climbs the church. It is built by
// the SAME sub-floor mechanism as a guest storey — same id derivation, same stair
// pair, same export gate — and differs only in its footprint and what is in it,
// which is exactly what the floor-furnisher table is for.
{
  const sealed = brief.validate(sanctuaryBrief(), ctx);
  for (const seed of [1, 3, 424242]) {
    const w = world.build(seed, "cozy-village", sealed);
    checkWorld(w, sealed, `belfry seed ${seed}`);
    const church = zoneNamed(w, "St. Ilde's");
    assert.ok(church, `seed ${seed}: the church compiled`);
    const tower = w.zones[`${church.id}u`];
    assert.ok(tower, `seed ${seed}: with a bell tower over it`);
    assert.equal(tower.name, "St. Ilde's bell tower", `seed ${seed}: named for the church`);
    assert.equal(tower.mapExport, false, `seed ${seed}: a tower is part of the church, not a second destination`);
    // Smaller than the nave — the one concession the mechanism made for it, and
    // the reason the two flights are placed independently at either end.
    assert.ok(tower.w < church.w && tower.h < church.h, `seed ${seed}: a tower is narrower than the church under it`);
    // THE BELL, and it is solid: the climb is to stand with it, not walk through it.
    const bells = [];
    for (let y = 0; y < tower.h; y++) {
      for (let x = 0; x < tower.w; x++) if (tower.object[tower.w * y + x] === "bell") bells.push({ x, y });
    }
    assert.equal(bells.length, 1, `seed ${seed}: one bell in the belfry (${bells.length})`);
    assert.equal(tower.solid[tower.w * bells[0].y + bells[0].x], 1, `seed ${seed}: and it blocks`);
    // CLIMBABLE, through the Sim: from the tile inside the church door, west onto
    // the step, up the tower.
    const sim = new loadedPF.Sim(w);
    sim.teleport(church.id, church.spawn.x, church.spawn.y);
    assert.equal(walkUntilCross(sim, { left: true }), tower.id, `seed ${seed}: the player can climb the tower`);
    // And walk right round the bell once up there: it is a room, not a niche.
    const round = floodFill(tower, tower.spawn);
    for (const [dx, dy] of [
      [0, -1],
      [0, 1],
      [-1, 0],
      [1, 0],
    ]) {
      assert.ok(
        round.has(`${bells[0].x + dx},${bells[0].y + dy}`),
        `seed ${seed}: the bell is walled in on the ${dx},${dy} side`,
      );
    }
    assert.equal(walkUntilCross(sim, { down: true }), church.id, `seed ${seed}: and climb back down into the nave`);
    // The church keeps its nave: the tower took nothing from the floor below it.
    assert.ok(church.object.includes("altar"), `seed ${seed}: the altar is still there`);
    assert.equal(w.zones[`${church.id}b`], undefined, `seed ${seed}: and no crypt was dug — that is not the rule`);
  }
}

// 73. DEPTH IS CAPPED AT ONE EACH WAY, and not by a guard that could be forgotten
// — `h1uu` cannot be spelled, because only interiorRoom() mints floors and the
// floors it mints never mint their own. Swept across the file's fixtures.
{
  const fixtures = [
    ["hearthwick", brief.validate(bedsBrief(), ctx)],
    ["inn", brief.validate(innBrief({ scale: "town", prosperity: "thriving" }, 6), ctx)],
    ["sanctuary", brief.validate(sanctuaryBrief(), ctx)],
    ["cellars", brief.validate(cellarBrief("thriving"), ctx)],
    ["bunkhouse", brief.validate(bunkhouseBrief(5), ctx)],
    ["six", brief.validate(houseBrief("Sixfold", 6, "folk"), ctx)],
    ["bellwether", brief.validate(bellwetherBrief(), ctx)],
    ["defaults", brief.defaults("cozy-village", 424242)],
    ["colony", brief.defaults("sci-fi-colony", 424242)],
  ];
  let floorsSeen = 0;
  let stairsSeen = 0;
  for (const [label, sealed] of fixtures) {
    for (const seed of [1, 3, 11, 424242]) {
      const w = world.build(seed, "cozy-village", sealed);
      for (const id of Object.keys(w.zones)) {
        assert.ok(/^(z|h|s)\d+[ub]?$/.test(id), `${label} seed ${seed}: zone id "${id}" is more than one flight off`);
        if (!/[ub]$/.test(id)) continue;
        floorsSeen++;
        assert.ok(w.zones[groundFloorId(id)], `${label} seed ${seed}: floor ${id} has no building under it`);
        assert.equal(w.zones[id].mapExport, false, `${label} seed ${seed}: floor ${id} would claim a map row`);
      }
      // Every stair tile is a portal and every stair portal has a stair tile under
      // it. This is the guard against a furnisher one day being laid over a step
      // the shell claimed before it ran: the step would still teleport, invisibly,
      // from under a table.
      for (const zone of Object.values(w.zones)) {
        for (const step of stairsIn(zone)) {
          assert.ok(step.portal, `${label} seed ${seed}: ${zone.id} has a step at ${step.x},${step.y} firing nothing`);
          stairsSeen++;
        }
        for (const portal of zone.portals) {
          // The portals BETWEEN floors of one building — the stairs, and nothing
          // else: a front door leads to another building's id entirely.
          if (portal.toZone === zone.id || groundFloorId(portal.toZone) !== groundFloorId(zone.id)) continue;
          assert.ok(
            STAIR_TILES.has(zone.object[zone.w * portal.y + portal.x]),
            `${label} seed ${seed}: ${zone.id} → ${portal.toZone} is a portal with no step painted on it`,
          );
        }
      }
    }
  }
  assert.ok(floorsSeen > 40, `the sweep actually visited floors (${floorsSeen})`);
  assert.ok(stairsSeen > 80, `and steps (${stairsSeen})`);
}

// 74. NOBODY STANDS IN THE STAIRWELL. A stair is a portal, and standable()
// already refuses portal tiles — the claim this release leans on rather than a
// rule of its own, so it is checked against real casts at every daypart instead
// of taken on trust.
{
  const fixtures = [
    ["hearthwick", brief.validate(bedsBrief(), ctx)],
    ["packed-inn", brief.validate(innBrief({ prosperity: "struggling" }, 6), ctx)],
    ["cellars", brief.validate(cellarBrief("thriving"), ctx)],
    ["bunkhouse", brief.validate(bunkhouseBrief(5), ctx)],
    ["six", brief.validate(houseBrief("Sixfold", 6, "folk"), ctx)],
  ];
  let stood = 0;
  let steppedOn = 0;
  for (const [label, sealed] of fixtures) {
    for (const seed of [1, 3, 11]) {
      const w = world.build(seed, "cozy-village", sealed);
      const sim = new loadedPF.Sim(w);
      // Non-vacuous: the world being swept really does have stairs in it.
      assert.ok(
        Object.values(w.zones).some((zone) => stairsIn(zone).length),
        `${label} seed ${seed}: the world has stairs to stand on`,
      );
      // THE MECHANISM, asked directly. A sweep of where the cast ended up passes
      // whether the rule holds or the dice were merely kind — a stair is one tile
      // in a room of a hundred and forty. So put the question to standable()
      // itself, on every step in the world: it must refuse, because a step is a
      // portal and that is the only thing keeping anybody off it.
      for (const zone of Object.values(w.zones)) {
        for (const step of stairsIn(zone)) {
          assert.equal(
            loadedPF.schedule.standable(zone, step.x, step.y),
            false,
            `${label} seed ${seed}: standable() would park an NPC on the step at ${zone.id} ${step.x},${step.y}`,
          );
          steppedOn++;
        }
      }
      for (const min of [6 * 60, 12 * 60, 19 * 60, 23 * 60]) {
        sim.clockMin = min;
        sim.resolveSchedules();
        for (const zone of Object.values(w.zones)) {
          const steps = new Set(stairsIn(zone).map((step) => `${step.x},${step.y}`));
          for (const npc of zone.npcs) {
            const x = Math.round(npc.x);
            const y = Math.round(npc.y);
            assert.ok(!steps.has(`${x},${y}`), `${label} seed ${seed} @${min}: ${npc.name} stands on the stairs`);
            assert.ok(
              loadedPF.schedule.standable(zone, x, y),
              `${label} seed ${seed} @${min}: ${npc.name} stands somewhere illegal in ${zone.id}`,
            );
            stood++;
          }
        }
      }
    }
  }
  assert.ok(stood > 400, `the sweep actually placed NPCs (${stood})`);
  assert.ok(steppedOn > 60, `and actually asked about steps (${steppedOn})`);
}

console.log("brief validator + compiler: all cases passed");
