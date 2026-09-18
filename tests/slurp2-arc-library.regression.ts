/**
 * Arcs v2 phase 2: arc types live in the `arcLibrary` setting. Old `kind` values and the old
 * `arcAllowedKinds` list migrate, auto arcs follow Creator tags, and running arcs keep their copy.
 */
import assert from "node:assert/strict";
import { join } from "node:path";
import {
  makeSlurpProject,
  readSlurpProject,
  slurpArcLibraryFromLegacy,
  slurpAutoArcType,
  slurpProjectTick,
  type SlurpArcType,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-project.ts";
import { slurp2Source } from "./slurp2-source";

const at = new Date("2026-09-13T10:00:00.000Z");

// Old kind → typeId; custom → null.
assert.equal(readSlurpProject({ id: "a", title: "t", kind: "moving" })?.typeId, "moving");
assert.equal(readSlurpProject({ id: "a", title: "t", kind: "custom" })?.typeId, null);
assert.equal(readSlurpProject({ id: "a", title: "t", kind: "trip", typeId: "mine" })?.typeId, "mine");

// arcAllowedKinds → enabled. No stored list: everything on, breakup included (no tone limits).
const migrated = slurpArcLibraryFromLegacy(["moving", "trip"]);
assert.deepEqual(
  migrated.filter((type) => type.enabled).map((type) => type.id),
  ["moving", "trip"],
);
assert.ok(slurpArcLibraryFromLegacy(undefined).every((type) => type.enabled && type.builtin && !type.hidden));
const storage = slurp2Source(
  join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages/server/src/services/storage/slurp.storage.ts"),
);
assert.match(storage, /rawRecord\.arcLibrary \?\? slurpArcLibraryFromLegacy\(rawRecord\.arcAllowedKinds\)/u);
assert.doesNotMatch(storage, /arcAllowedKinds: z\./u, "arcAllowedKinds is gone from the schema");
assert.match(storage, /tags: replaceSlurpDiscoveryTag\(type\.tags, from, to\)/u, "tag rename reaches arc types");

// Tag-filtered auto pick: a tagged type only goes to Creators sharing a tag.
const gym: SlurpArcType = { ...migrated[0]!, id: "gym", name: "Gym", enabled: true, tags: ["Fitness"] };
const pick = (creatorTags: string[], creatorAccountId: string) =>
  slurpAutoArcType({
    creatorAccountId,
    at,
    projects: [],
    library: [gym, { ...gym, id: "off", enabled: false, tags: [] }, { ...gym, id: "gone", hidden: true, tags: [] }],
    creatorTags,
    lastAutoAt: null,
    cooldownWeeks: 3,
  });
const lucky = Array.from({ length: 400 }, (_, index) => `c-${index}`).find((id) => pick(["fitness"], id));
assert.ok(lucky);
assert.equal(pick(["fitness"], lucky)?.id, "gym");
assert.equal(pick(["art"], lucky), null, "no shared tag, and disabled or hidden types never count");

// A running arc keeps its copy when the type is edited.
const arc = makeSlurpProject("r1", { type: gym }, at)!;
gym.name = "Renamed";
gym.chapters[0]!.label = "changed";
assert.equal(arc.title, "Gym");
assert.equal(arc.chapters[0], "deciding to move");

// A type with no chapters runs open-ended for its duration.
const open = makeSlurpProject("r2", { type: { ...gym, chapters: [], durationDays: 5 } }, at)!;
assert.equal(open.durationDays, 5);
assert.equal(slurpProjectTick(open, new Date(at.getTime() + 4 * 86_400_000)).status, "active");
assert.equal(slurpProjectTick(open, new Date(at.getTime() + 5 * 86_400_000)).status, "complete");

console.log("slurp2 arc library regression passed");
