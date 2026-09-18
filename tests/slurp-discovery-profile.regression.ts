import assert from "node:assert/strict";
import {
  normalizeSlurpDiscoveryTags,
  slurpDiscoveryFields,
  slurpDiscoveryProfileSchema,
  slurpGeneratedDiscoveryProfileSchema,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-discovery-profile";
import { normalizeNoodlerStageProfileDraft } from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-stage-profile-normalize";
import { slurp2Source } from "./slurp2-source";

assert.deepEqual(slurpDiscoveryFields(undefined), { gender: null, tags: [] });
assert.deepEqual(slurpDiscoveryFields({ gender: "unknown", tags: ["art"] }), { gender: null, tags: ["art"] });
assert.deepEqual(normalizeSlurpDiscoveryTags(["  Cosplay ", "cosplay", "ＦＥＥＴ", "", "x".repeat(25)]), [
  "cosplay",
  "feet",
]);
assert.deepEqual(normalizeSlurpDiscoveryTags(["art", "invented"], ["art"]), ["art"]);
assert.deepEqual(normalizeSlurpDiscoveryTags(["My   Vibe", "my vibe"]), ["My Vibe"]);
assert.equal(slurpDiscoveryProfileSchema.safeParse({ gender: "female", tags: ["art"] }).success, true);
assert.equal(slurpDiscoveryProfileSchema.safeParse({ gender: null, tags: Array(9).fill("art") }).success, false);
// The allowed list is the `discoveryTags` setting, applied by the draft service after parsing.
assert.deepEqual(slurpGeneratedDiscoveryProfileSchema.parse({ gender: null, tags: ["Art", "invented"] }), {
  gender: null,
  tags: ["art", "invented"],
});
assert.equal(
  slurpGeneratedDiscoveryProfileSchema.safeParse({ gender: "female" }).success,
  false,
  "malformed model output must trigger the correction path",
);
assert.deepEqual(
  normalizeNoodlerStageProfileDraft({
    name: "Velvet",
    gender_identity: "female",
    categories: ["cosplay", "gaming"],
  }),
  {
    name: "Velvet",
    gender_identity: "female",
    categories: ["cosplay", "gaming"],
    displayName: "Velvet",
    gender: "female",
    handle: "velvet",
    bio: "",
    stagePersonality: "",
    tags: ["cosplay", "gaming"],
  },
);

const restored = slurpDiscoveryFields(
  JSON.parse(JSON.stringify({ gender: "other", tags: [" Art ", "art", "roleplay"] })),
);
assert.equal(restored.gender, "other");
assert.deepEqual(restored.tags, ["art", "roleplay"], "metadata survives a backup-style JSON round trip");

const storage = slurp2Source("packages/slurp2/src/engine/packages/server/src/services/storage/slurp.storage.ts");
assert.match(storage, /const discovery = slurpDiscoveryFields\(rawProfile\)/u);
assert.match(storage, /gender: stageProfile\.gender,[\s\S]*tags: stageProfile\.tags/u);

console.log("slurp discovery profile regression passed");
