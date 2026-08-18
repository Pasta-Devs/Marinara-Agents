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
function checkWorld(w, sealed, label) {
  assert.equal(w.startZone, "z1", `${label}: settlement is z1`);
  assert.ok(w.zones.z1, `${label}: z1 exists`);
  // Every named zone in the brief exists under its ordinal id.
  for (const [id, name] of Object.entries(sealed._ids.zones)) {
    assert.ok(w.zones[id], `${label}: zone ${id} (${name}) compiled`);
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
  // Buildings honor the arithmetic (§4.5): at least one roof per distinct
  // household homed at the settlement root. (Household MERGING only kicks in
  // under area pressure, which no harness fixture reaches — a future stress
  // fixture that trips this assert should relax it to the merged-block count.)
  const v = w.zones.z1;
  const rootName = sealed._ids.zones.z1;
  // Non-residents get no dwelling, so they do not demand a root door.
  const rootHouseholds = new Set(
    sealed.cast
      .filter((c) => c.home === rootName && (c.standing ?? "resident") === "resident")
      .map((c) => c.household),
  );
  const doorCount = v.object.filter((t) => t === "door").length;
  assert.ok(
    doorCount >= rootHouseholds.size,
    `${label}: a roof per settlement household (${doorCount} doors < ${rootHouseholds.size} households)`,
  );
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
// a public spot (here the residents' buildings consume every lot).
{
  const sealed = brief.validate(
    {
      scale: "village",
      name: "Fullford",
      cast: [
        { name: "Ona", role: "reeve", kind: "leader", tint: "blue", home: "Fullford", household: 1 },
        { name: "Pel", role: "farmer", kind: "grower", tint: "green", home: "Fullford", household: 2 },
        { name: "Gar", role: "watch", kind: "guard", tint: "red", home: "Fullford", household: 3 },
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
  dayOf(12 * 60);
  const drifterDay = findNpc("Wisp");
  dayOf(23 * 60);
  const drifterNight = findNpc("Wisp");
  assert.equal(drifterNight.zoneId, innId, "the drifter sleeps at the inn");
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
  // Guard against a vacuous pass: the bug needs arrivals from another zone.
  const arrived = w.zones[innId].npcs.length;
  assert.ok(arrived >= 4, `the inn genuinely fills up at night (${arrived} NPCs)`);
  const seen = new Map();
  for (const npc of w.zones[innId].npcs) {
    const tile = `${Math.round(npc.x)},${Math.round(npc.y)}`;
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
    const dwellingId = hearths[0]._sched.home.zoneId;
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
    [sealedRooms, ["The Kettle", "Ben's shop", "Cass's home"], 4],
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

    // The transient takes a real bed at the inn rather than standing among the tables.
    const guest = findNpc(w, "Wisp");
    assert.equal(guest.zone.name, "The Kettle", `seed ${seed}: the drifter beds down at the inn`);
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

// 52. Every resident under one roof gets their OWN bed. Six is CAPS.household,
// the largest a single dwelling ever has to sleep — and two sprites on one tile
// makes the lower one un-talkable, so "a bed each" is an invariant rather than a
// nicety. (The pre-0.8.0 shape put the whole household on one door apron; case
// 14j keeps that overflow path under test by forcing the old handle by hand.)
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
    assert.equal(tiles.size, 6, `seed ${seed}: six sleepers, six beds (${tiles.size} distinct)`);
    for (const tile of tiles) {
      const [x, y] = tile.split(",").map(Number);
      assert.equal(homeZone.object[homeZone.w * y + x], "bed", `seed ${seed}: ${tile} is an actual bed tile`);
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
      assert.equal(homeZone.object[homeZone.w * npc.y + npc.x], "bed", `seed ${seed}: ${npc.name} is in a bed`);
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
    // every interior grew.
    assert.ok(
      !Object.values(w.zones).some((zone) => zone !== shop && zone.object.includes("shelf")),
      `seed ${seed}: nothing else in the world sprouted shelving`,
    );

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

    // Off duty he goes home to his own bed, not back onto the apron.
    sim.clockMin = 23 * 60;
    sim.resolveSchedules();
    const home = Object.values(w.zones).find((zone) => zone.npcs.some((npc) => npc.name === "Ben"));
    assert.notEqual(home, shop, `seed ${seed}: the smith does not sleep in the shop`);
    const asleep = home.npcs.find((npc) => npc.name === "Ben");
    assert.equal(
      home.object[home.w * asleep.y + asleep.x],
      "bed",
      `seed ${seed}: a shop owner sleeps in their dwelling's bed`,
    );
  }
}

console.log("brief validator + compiler: all cases passed");
