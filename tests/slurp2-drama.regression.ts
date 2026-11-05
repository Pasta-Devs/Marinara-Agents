/**
 * Drama (`docs/DRAMA.md`): situations and dramas as Story Pack data. The schema refuses a bad entry
 * with a clear message, old packs import unchanged, imports land in their own library (never over
 * Slurp's or another pack's ids), and only switched-on entries run.
 */
import assert from "node:assert/strict";
import {
  normalizeSlpDramaSettings,
  slpDramaSchema,
  slpSituationSchema,
  SLP_DEFAULT_DRAMA_SETTINGS,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-drama.ts";
import { slpStoryPackSchema } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-story-engine.ts";
import {
  applySlpDramaEntries,
  readSlpDramaLibrary,
  slpDramaCatalog,
  slpEnabledDrama,
  SLP_EMPTY_DRAMA_LIBRARY,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/events/slp-drama-library.ts";
import {
  exportSlpStoryPack,
  parseSlpStoryPack,
  previewSlpStoryPack,
  slpBundledStoryPacks,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/events/slp-story-packs.ts";
import { partner, rivals } from "./slurp2-drama-fixtures";

const issues = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.success ? [] : result.error!.issues.map((issue) => issue.message);

async function main() {
  // Valid entries parse; defaults fill in; nothing is on by default.
  const drama = slpDramaSchema.parse(rivals);
  assert.equal(drama.enabled, false);
  assert.equal(drama.cooldownDays, 21);
  assert.equal(drama.stages[1]!.choice!.timeoutDays, 2);
  const situation = slpSituationSchema.parse(partner);
  assert.equal(situation.perDay, 2);

  // The rules, each with its own message.
  const broken = (patch: (copy: typeof rivals) => void) => {
    const copy = structuredClone(rivals);
    patch(copy);
    return issues(slpDramaSchema.safeParse(copy));
  };
  assert.ok(broken((copy) => delete (copy.exit as { heat?: unknown }).heat).some((m) => m.includes("needs a heat")));
  assert.ok(
    broken((copy) => ((copy.stages[0]!.beats[0] as { role: string }).role = "nobody")).some((m) =>
      m.includes('unknown role "nobody"'),
    ),
  );
  assert.ok(
    broken((copy) => (copy.stages[1]!.choice!.options[0]!.next = "nowhere")).some((m) => m.includes("leads nowhere")),
  );
  assert.ok(
    broken((copy) => (copy.stages[1]!.choice!.default = 3)).some((m) => m.includes("default is not an option")),
  );
  assert.ok(broken((copy) => (copy.maxDays = 1)).some((m) => m.includes("maxDays")));
  assert.ok(broken((copy) => (copy.stages[1]!.key = "spark")).some((m) => m.includes("stage keys must be unique")));
  assert.ok(
    broken((copy) => ((copy.stages[0]!.beats[0] as Record<string, unknown>).heat = { line: "x" })).some((m) =>
      m.includes("only a post beat carries heat"),
    ),
  );
  assert.ok(
    issues(
      slpSituationSchema.safeParse({ ...partner, deck: [{ role: "crowd", channel: "dm", to: "you", seed: "x" }] }),
    ).some((m) => m.includes("the crowd only comments")),
  );
  assert.ok(issues(slpDramaSchema.safeParse({ ...rivals, id: "Bad Id" })).length > 0, "ids are lowercase keys");

  // CodeRabbit: role conditions name real roles; "fans" and "crowd" only where they belong.
  assert.ok(
    broken((copy) => ((copy.roles[1]!.needs as { sharesNicheWith: string }).sharesNicheWith = "nobody")).some((m) =>
      m.includes('unknown role "nobody"'),
    ),
  );
  assert.ok(
    broken((copy) => ((copy.stages[0]!.beats[0] as { on: string }).on = "crowd")).some((m) =>
      m.includes('unknown role "crowd"'),
    ),
  );
  assert.ok(
    issues(
      slpSituationSchema.safeParse({ ...partner, deck: [{ role: "her", channel: "dm", to: "fans", seed: "x" }] }),
    ).some((m) => m.includes('unknown role "fans"')),
  );

  // Old packs import unchanged; a pack with drama entries parses; the bundled packs still build.
  const old = {
    format: "marinara-slurp-story-pack",
    schemaVersion: 1,
    id: "old",
    version: "1",
    name: "Old",
    description: "",
  };
  const parsedOld = slpStoryPackSchema.parse(old);
  assert.deepEqual([parsedOld.situations, parsedOld.dramas], [[], []]);
  const withDrama = parseSlpStoryPack({ ...old, id: "pack-a", situations: [partner], dramas: [rivals] });
  assert.equal(withDrama.errors.length, 0);
  // The runtime runs storylines: a drama that loops back passes v1 but is refused, with the reason.
  const last = rivals.stages.length - 1;
  const loop = {
    ...rivals,
    id: "loop",
    stages: rivals.stages.map((stage, index) =>
      index === last ? { ...stage, choice: undefined, next: rivals.stages[0]!.key } : stage,
    ),
  };
  const looped = parseSlpStoryPack({ ...old, id: "pack-loop", dramas: [loop] });
  assert.equal(looped.pack, null);
  assert.match(looped.errors.join(" "), /drama:loop: .*leads back to itself/);
  assert.ok(slpBundledStoryPacks().length > 0);

  // Preview → apply → library: new first, then an update of the same pack; another pack's id conflicts.
  const preview = previewSlpStoryPack(withDrama.pack!, { arcs: [], events: [], drama: SLP_EMPTY_DRAMA_LIBRARY });
  const kinds = preview.entries.map((entry) => `${entry.kind}:${entry.status}`);
  assert.deepEqual(kinds, ["situation:new", "drama:new"]);
  let library = applySlpDramaEntries(SLP_EMPTY_DRAMA_LIBRARY, "pack-a", [
    { kind: "situation", value: situation },
    { kind: "drama", value: drama },
  ]);
  assert.equal(library.dramas[0]!.packId, "pack-a");
  const again = previewSlpStoryPack(withDrama.pack!, { arcs: [], events: [], drama: library });
  assert.deepEqual(
    again.entries.map((entry) => entry.status),
    ["update", "update"],
  );
  const other = previewSlpStoryPack({ ...withDrama.pack!, id: "pack-b" }, { arcs: [], events: [], drama: library });
  assert.deepEqual(
    other.entries.map((entry) => [entry.status, entry.selected]),
    [
      ["conflict", false],
      ["conflict", false],
    ],
  );
  library = applySlpDramaEntries(library, "pack-b", [{ kind: "drama", value: { ...drama, name: "Hijack" } }]);
  assert.equal(library.dramas[0]!.name, "Rivals", "another pack never overwrites");
  library = applySlpDramaEntries(library, "pack-a", [
    { kind: "drama", value: { ...drama, name: "Rivals 2", enabled: true } },
  ]);
  assert.deepEqual(
    [library.dramas.length, library.dramas[0]!.name, library.dramas[0]!.enabled],
    [1, "Rivals 2", false],
  );

  // The library reads back leniently, and exports back into a pack.
  const stored = JSON.parse(JSON.stringify(library));
  stored.dramas.push({ packId: "x", id: "broken" }, { id: "no-pack", ...rivals });
  const read = readSlpDramaLibrary(stored);
  assert.deepEqual([read.situations.length, read.dramas.length], [1, 1]);
  assert.deepEqual(readSlpDramaLibrary("garbage"), SLP_EMPTY_DRAMA_LIBRARY);
  const exported = exportSlpStoryPack({ id: "mine", name: "Mine", arcs: [], events: [], drama: read });
  assert.deepEqual([exported.situations.length, exported.dramas.length], [1, 1]);
  assert.equal("packId" in exported.dramas[0]!, false);

  // A v2 pack imports its storylines into the drama library, switched off until picked.
  const v2 = parseSlpStoryPack({
    format: "marinara-slurp-story-pack",
    schemaVersion: 2,
    id: "pack-v2",
    version: "1",
    name: "V2",
    description: "",
    tracks: [],
    storylines: [
      {
        id: "baby",
        name: "Baby",
        cast: [{ key: "her" }],
        stages: [{ key: "early", label: "Early", days: [1, 2], next: "born" }],
        endings: [{ key: "born", label: "Born" }],
      },
    ],
  });
  assert.equal(v2.errors.length, 0, v2.errors.join(" "));
  const v2Preview = previewSlpStoryPack(v2.pack!, { arcs: [], events: [], drama: SLP_EMPTY_DRAMA_LIBRARY });
  assert.deepEqual(
    v2Preview.entries.map((entry) => `${entry.kind}:${entry.status}`),
    ["storyline:new"],
  );
  const v2Library = applySlpDramaEntries(SLP_EMPTY_DRAMA_LIBRARY, "pack-v2", [
    { kind: "storyline", value: v2.pack!.storylines![0]! },
  ]);
  assert.deepEqual(
    readSlpDramaLibrary(JSON.parse(JSON.stringify(v2Library))).storylines.map((entry) => [entry.id, entry.packId]),
    [["baby", "pack-v2"]],
  );
  // The routes parse the stored shell again: it reads as the v2 file, with the pack's own checks.
  assert.equal(parseSlpStoryPack(v2.pack).errors.length, 0);
  const badTrack = parseSlpStoryPack({
    ...v2.pack!,
    storylines: [{ ...v2.pack!.storylines![0]!, track: "nowhere" }],
  });
  assert.equal(badTrack.pack, null, "an unknown track is refused on the second parse too");
  assert.equal(parseSlpStoryPack({ ...v2.pack!, dramas: [rivals] }).pack, null, "storylines hold no other entries");
  // A v2 storyline may not take a v1 drama's id, and an imported one keeps no `source`.
  const clash = previewSlpStoryPack(
    { ...v2.pack!, storylines: [{ ...v2.pack!.storylines![0]!, id: rivals.id }] },
    {
      arcs: [],
      events: [],
      drama: applySlpDramaEntries(SLP_EMPTY_DRAMA_LIBRARY, "x", [{ kind: "drama", value: rivals }]),
    },
  );
  assert.deepEqual(
    clash.entries.map((entry) => entry.status),
    ["conflict"],
  );
  const sourced = applySlpDramaEntries(SLP_EMPTY_DRAMA_LIBRARY, "pack-v2", [
    { kind: "storyline", value: { ...v2.pack!.storylines![0]!, source: { kind: "drama", id: rivals.id } } },
  ]);
  assert.equal(JSON.parse(JSON.stringify(sourced)).storylines[0].source, undefined);
  // A storyline that stands in a situation is on only with that situation on.
  const within = {
    ...v2.pack!.storylines![0]!,
    id: "within",
    start: { ...v2.pack!.storylines![0]!.start, within: "situation:calm" },
  };
  const calm = { ...v2.pack!.storylines![0]!, id: "calm", stages: [{ key: "on", label: "On", next: [] }], endings: [] };
  const v2Catalog = { situations: [], dramas: [], storylines: [within, calm] } as unknown as Parameters<
    typeof slpEnabledDrama
  >[0];
  assert.deepEqual(
    slpEnabledDrama(v2Catalog, ["within"]).storylines.map((entry) => entry.id),
    [],
  );
  assert.deepEqual(
    slpEnabledDrama(v2Catalog, ["within", "calm"]).storylines.map((entry) => entry.id),
    ["within", "calm"],
  );

  // Only switched-on entries run, and a drama only with its situation on.
  const catalog = slpDramaCatalog(read);
  const needs = { ...drama, id: "needs-partner", requires: { situation: "test-partner" } };
  const withNeeds = { ...catalog, dramas: [...catalog.dramas, needs] };
  assert.deepEqual(slpEnabledDrama(withNeeds, []).dramas, []);
  assert.deepEqual(
    slpEnabledDrama(withNeeds, ["test-rivals", "needs-partner"]).dramas.map((entry) => entry.id),
    ["test-rivals"],
  );
  assert.deepEqual(
    slpEnabledDrama(withNeeds, ["needs-partner", "test-partner"]).dramas.map((entry) => entry.id),
    ["needs-partner"],
  );

  // Settings: defaults, and a bad field falls back alone.
  assert.deepEqual(SLP_DEFAULT_DRAMA_SETTINGS, { level: "lively", enabled: [], dials: {} });
  assert.deepEqual(normalizeSlpDramaSettings({ level: "chaos", enabled: ["test-rivals"] }), {
    level: "lively",
    enabled: ["test-rivals"],
    dials: {},
  });
  assert.deepEqual(normalizeSlpDramaSettings(null), SLP_DEFAULT_DRAMA_SETTINGS);
  // One bad id drops alone, duplicates go, the rest stays switched on.
  assert.deepEqual(normalizeSlpDramaSettings({ enabled: ["rivals", "Bad Id", 7, "rivals", "top-fan"] }).enabled, [
    "rivals",
    "top-fan",
  ]);
  assert.equal(
    normalizeSlpDramaSettings({ enabled: Array.from({ length: 150 }, (_, index) => `d${index}`) }).enabled.length,
    150,
  );

  console.log("slurp2 drama regression passed");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
