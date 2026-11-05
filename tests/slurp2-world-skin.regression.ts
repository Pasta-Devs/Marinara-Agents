/**
 * World skin (slurp2 0.4.8): a Creator from another era or world speaks their world's nouns, gets no
 * phone or screen camera, plays holidays as their own festivals, and meets culture-shock fans. A
 * modern Creator sees no change.
 */
import assert from "node:assert/strict";
import {
  normalizeSlurpWorldLens,
  slurpWorldEventsLine,
  slurpWorldLine,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-world-lens.ts";
import {
  mergeSlurpCanonAnchors,
  normalizeSlurpCanonAnchors,
  slurpCanonAnchorsPrompt,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-post-brief.ts";
import {
  slurpPermittedCameraSources,
  slurpPostCameraSource,
  slurpScreenFreeCamera,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-camera-source.ts";
import { compileSlurpFlavourBrief } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-creator-flavour.ts";
import { slurpWorldShockBodies } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/slp-world-copy.ts";
import { FLAVOUR_FIXTURES } from "./slurp2-flavour-fixtures.ts";
import { slurp2Source } from "./slurp2-source.ts";

// Lens: unknown or modern era is no lens; text is trimmed and festivals capped.
const elf = { era: "Fantasy", device: " a scrying  mirror ", money: "crowns", festivals: ["a", "b", "c", "d", "e"] };
assert.deepEqual(normalizeSlurpWorldLens(elf), {
  era: "fantasy",
  device: "a scrying mirror",
  money: "crowns",
  festivals: ["a", "b", "c", "d"],
});
assert.equal(normalizeSlurpWorldLens({ era: "modern", device: "a phone" }), undefined);
assert.equal(normalizeSlurpWorldLens({ era: "steampunk-ish" }), undefined);
assert.equal(normalizeSlurpWorldLens(null), undefined);
assert.equal(slurpWorldLine(undefined), "");
assert.equal(slurpWorldEventsLine(undefined), "");
const lens = normalizeSlurpWorldLens(elf)!;
assert.match(slurpWorldLine(lens), /fantasy world.*scrying mirror.*crowns/u);
assert.match(slurpWorldEventsLine(lens), /such as a\)/u);

// The card reading asks for the world and keeps it; a world alone is a reading worth storing.
assert.match(slurpCanonAnchorsPrompt("card").system, /"world":\{"era":"modern"/u);
const read = normalizeSlurpCanonAnchors({ places: ["the tower"], world: elf })!;
assert.equal(read.world?.era, "fantasy");
assert.equal(normalizeSlurpCanonAnchors({ places: ["the gym"], world: { era: "modern" } })!.world, undefined);
assert.equal(normalizeSlurpCanonAnchors({ world: elf })?.world?.device, "a scrying mirror");
// The player's fix survives a new reading; an untouched lens follows the new reading.
const fixed = { ...read, world: { ...read.world!, money: "gold" } };
const fresh = normalizeSlurpCanonAnchors({ places: ["the tower"], world: { ...elf, money: "silver" } })!;
assert.equal(mergeSlurpCanonAnchors(fixed, read, fresh)?.world?.money, "gold");
assert.equal(mergeSlurpCanonAnchors(read, read, fresh)?.world?.money, "silver");

// Brief: the world line is there for a lens and absent for a modern Creator.
const fixture = FLAVOUR_FIXTURES[0]!;
const source = (anchors: typeof fixture.anchors) => ({
  accountId: fixture.id,
  name: fixture.name,
  card: fixture.card,
  anchors,
  ownLines: fixture.captions,
});
const modern = compileSlurpFlavourBrief(source(fixture.anchors), { use: "post", sequence: 3 }).text;
assert.doesNotMatch(modern, /Your world:/u);
const skinned = compileSlurpFlavourBrief(source({ ...fixture.anchors!, world: lens }), {
  use: "post",
  sequence: 3,
}).text;
assert.match(skinned, /Your world: a fantasy world/u);
assert.equal(skinned.replace(/\n\nYour world:[^\n]*/u, ""), modern, "only the world line differs");

// Camera: no phone or screen source without screens, unchanged with them.
assert.deepEqual(
  slurpPermittedCameraSources({ companyCanHoldCamera: true, screens: false }).filter((source) =>
    ["mirror", "desk", "screenshot"].includes(source),
  ),
  [],
);
assert.deepEqual(
  slurpPermittedCameraSources({ companyCanHoldCamera: true }),
  slurpPermittedCameraSources({ companyCanHoldCamera: true, screens: true }),
);
for (let sequence = 0; sequence < 60; sequence += 1)
  assert.ok(
    !["mirror", "desk", "screenshot"].includes(
      slurpPostCameraSource("elf", sequence, { companyCanHoldCamera: false, screens: false }),
    ),
  );

// Culture shock: a bank per era, none for a modern Creator.
assert.deepEqual(slurpWorldShockBodies(undefined), []);
for (const era of ["historical", "fantasy", "scifi", "other"] as const)
  assert.ok(slurpWorldShockBodies({ ...lens, era }).length >= 5, `${era} has a culture-shock bank`);

// Wiring: holidays, pulse comments, the post camera and live shows read the lens.
const livePrompt = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/modules/live/slp-live-prompt.ts");
assert.equal(
  livePrompt.match(/\.\.\.\(host\.world \? \[host\.world\] : \[\]\)/gu)?.length,
  2,
  "both live prompts open with the world",
);
assert.match(
  slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/live/slp-live-beat.ts"),
  /world: slurpWorldLine\(await readSlurpWorldLens\(db, host\.id\)\)/u,
);
assert.match(
  slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/world/slp-story-context.ts"),
  /slurpWorldEventsLine\(await readSlurpWorldLens/u,
);
assert.match(
  slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/world/slp-world-actions.ts"),
  /slurpWorldShockBodies\(await readSlurpWorldLens/u,
);
assert.match(
  slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-generation-service.ts"),
  /const screens = !\(await readSlurpWorldLens/u,
);

// A reused shoot keeps no screen camera for a lens Creator (wired in slurp-shoot.regression.ts).
assert.equal(slurpScreenFreeCamera("mirror", false), null);
assert.equal(slurpScreenFreeCamera("mirror", true), "mirror");
assert.equal(slurpScreenFreeCamera("tripod", false), "tripod");
assert.equal(slurpScreenFreeCamera(null, true), null);

console.log("slurp2 world skin: ok");
