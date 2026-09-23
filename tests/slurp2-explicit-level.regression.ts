import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source";
import {
  SLURP_BUILT_IN_EXPLICIT_LEVEL,
  sanitizeSlurpPostGuidance,
  selectSlurpExplicitLevel,
  slurpPostSexualLevel,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-guidance";
import { slurpVisualBriefFromSituation } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-visual-brief";
import { slurpPostVariation } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-variation";

// How far a Creator's pictures go is a typed value, because the visual brief carries it as one.
// It used to be hardcoded to `intent === "teaser" ? "suggestive" : "none"`, so every locked post —
// the one somebody paid for — was briefed as non-sexual.

const guidance = sanitizeSlurpPostGuidance({
  defaults: { level: "nudity" },
  creators: { soft: { level: "suggestive" }, hard: { level: "explicit" } },
});
assert.equal(selectSlurpExplicitLevel(guidance, "hard"), "explicit", "a Creator override wins");
assert.equal(selectSlurpExplicitLevel(guidance, "soft"), "suggestive");
assert.equal(selectSlurpExplicitLevel(guidance, "unset"), "nudity", "no override falls back to the global level");
assert.equal(
  selectSlurpExplicitLevel(sanitizeSlurpPostGuidance({}), "unset"),
  SLURP_BUILT_IN_EXPLICIT_LEVEL,
  "nothing configured falls back to the shipped level",
);
// A level that is not one of the four is not a level.
assert.equal(sanitizeSlurpPostGuidance({ defaults: { level: "filth" } }).defaults.level, "");

// The paywall has to mean something: locked delivers, public sits one step under it.
assert.equal(slurpPostSexualLevel({ level: "explicit", access: "locked" }), "explicit");
assert.equal(slurpPostSexualLevel({ level: "explicit", access: "public" }), "nudity");
assert.equal(slurpPostSexualLevel({ level: "suggestive", access: "public" }), "none");
// Stepping down from the bottom stays at the bottom rather than falling off the list.
assert.equal(slurpPostSexualLevel({ level: "none", access: "public" }), "none");
// A schedule notice is not a nude whatever the dial says.
for (const intent of ["business", "appreciation"]) {
  assert.equal(slurpPostSexualLevel({ level: "explicit", access: "locked", intent }), "none", intent);
}

const variation = slurpPostVariation("creator-a", 3);
const brief = (access: "public" | "locked", explicitLevel: "none" | "suggestive" | "nudity" | "explicit") =>
  slurpVisualBriefFromSituation({
    variation,
    axes: { intent: "set" },
    cameraInstruction: "Camera: their own phone.",
    access,
    explicitLevel,
  });
assert.equal(brief("locked", "explicit").sexualLevel, "explicit", "a paid post delivers the Creator's level");
assert.equal(brief("public", "explicit").sexualLevel, "nudity");

// The image brief says what the picture may show at every level, rather than one blanket refusal.
const imageBrief = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-image-brief.ts");
assert.match(imageBrief, /LEVEL_LINES\[input\.sexualLevel\]/u, "the brief must state the level it was given");
for (const level of ["none", "suggestive", "nudity", "explicit"]) {
  assert.match(imageBrief, new RegExp(`\\b${level}:`, "u"), `${level} needs its own line`);
}

// An image model reads "poorly lit" and "dull" as instructions and returns exactly that.
for (const path of [
  "packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-camera-source.ts",
  "packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-post-prompt.ts",
  "packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-production-profile.ts",
]) {
  assert.doesNotMatch(
    slurp2Source(path).replace(/^\s*(?:\/\/|\*).*$/gmu, ""),
    /poorly lit|badly framed|\bdull\b|wrong light/u,
    `${path} must not ask the image model for a bad picture`,
  );
}

// Personality is not a visual fact, and a field label is not part of a picture.
for (const path of [
  "packages/slurp2/src/engine/packages/server/src/slp/features/media/slp-images-service.ts",
  "packages/slurp2/src/engine/packages/server/src/slp/features/media/slp-public-images-service.ts",
]) {
  const source = slurp2Source(path);
  assert.match(source, /characterPersonality: ""/u, `${path} must not send personality to the image provider`);
  assert.match(source, /stripAppearanceLabel\(characterDescription\)/u, `${path} must strip the appearance label`);
}

console.log("slurp2-explicit-level regression passed");
