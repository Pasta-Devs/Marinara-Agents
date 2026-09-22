import assert from "node:assert/strict";
import {
  formatSlpWardrobeCloset,
  readSlpWardrobeLooks,
  slpWardrobeLookInputSchema,
  type SlpWardrobeLook,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-wardrobe";
import {
  resolveSlurpWardrobeSelection,
  slurpWardrobePrompt,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-wardrobe-selection";
import {
  buildSlpWardrobeImportMessages,
  parseSlpWardrobeImportDrafts,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-wardrobe-import";
import { slurp2Source } from "./slurp2-source";

const look = (
  id: string,
  suitability: SlpWardrobeLook["suitability"],
  createdAt: string,
  enabled = true,
): SlpWardrobeLook => ({
  id,
  name: `Look ${id}`,
  summary: `${id} compact summary`,
  description: `${id} exact clothing description`,
  tags: [id],
  suitability,
  enabled,
  source: { kind: "manual" },
  createdAt,
  updatedAt: createdAt,
});

const publicOld = look("public-old", "public", "2026-01-01T00:00:00.000Z");
const bothNew = look("both-new", "both", "2026-02-01T00:00:00.000Z");
const locked = look("locked", "locked", "2026-03-01T00:00:00.000Z");
const disabled = look("disabled", "both", "2026-04-01T00:00:00.000Z", false);
const looks = [publicOld, bothNew, locked, disabled];

assert.equal(
  resolveSlurpWardrobeSelection({
    looks,
    access: "public",
    scene: { wardrobeId: "both-new", setting: "x", action: "x", expression: "x", visualDirection: "x" },
  }).look?.id,
  "both-new",
);

const incompatible = resolveSlurpWardrobeSelection({
  looks,
  access: "public",
  scene: { wardrobeId: "locked", setting: "x", action: "x", expression: "x", visualDirection: "x" },
  recentIds: ["public-old"],
});
assert.equal(incompatible.look?.id, "both-new", "an incompatible choice falls back to the least-recent suitable look");
assert.equal(incompatible.requestedId, "locked");
assert.equal(incompatible.fallback, true);

assert.equal(
  resolveSlurpWardrobeSelection({ looks, access: "locked", recentIds: ["both-new"] }).look?.id,
  "locked",
  "a missing choice also avoids a recently used compatible look",
);
assert.doesNotMatch(formatSlpWardrobeCloset(looks), /disabled/u);
assert.match(slurpWardrobePrompt(looks, "public", ["both-new"]) ?? "", /public-old[\s\S]*both-new/u);

assert.equal(
  readSlpWardrobeLooks(JSON.stringify([...looks, looks[0]])).length,
  4,
  "stored duplicate IDs are discarded",
);
assert.equal(slpWardrobeLookInputSchema.safeParse({ ...publicOld, name: "" }).success, false);

assert.deepEqual(parseSlpWardrobeImportDrafts("not usable JSON"), [], "malformed model output imports nothing");
const imported = parseSlpWardrobeImportDrafts(
  JSON.stringify({
    looks: [
      {
        name: "Source look",
        summary: "black dress and silver chain",
        description: "a fitted black dress with a thin silver chain necklace",
        tags: ["Black", "black"],
        suitability: "both",
        enabled: true,
        evidence: "she wore her fitted black dress with the silver chain",
      },
      {
        name: "Look PUBLIC-OLD",
        summary: "duplicate",
        description: "different words",
        tags: [],
        suitability: "both",
        enabled: true,
        evidence: "duplicate name",
      },
    ],
  }),
  looks,
);
assert.equal(imported.length, 1, "existing names and descriptions are deduplicated before review");
assert.deepEqual(imported[0]?.tags, ["black"]);
assert.match(buildSlpWardrobeImportMessages("Lore", "source clothes")[0]?.content ?? "", /Do not invent/u);

const generation = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-generation.service.ts",
);
assert.match(generation, /wardrobeLookId/u, "the selected look is recorded on post metadata");
assert.match(generation, /recentWardrobeIds/u, "recent looks affect selection");
assert.match(generation, /askModelForScene/u, "automatic image posts use the hybrid scene contract");

const importService = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-wardrobe-import.ts",
);
assert.match(importService, /Do not invent, complete, embellish, or infer/u);
assert.match(importService, /evidence is a short exact-or-close source fragment/u);

const routes = slurp2Source(
  "packages/slurp2/src/engine/packages/server/src/slp/features/creators/slp-wardrobe-routes.ts",
);
assert.match(routes, /import-preview/u);
assert.match(routes, /entryIds/u, "a lorebook import can be narrowed to selected entries");
assert.match(routes, /wardrobe\/lorebook-entries/u, "the picker can list enabled entries without reading their text");
assert.match(routes, /tryCreatorAccountOperation/u, "wardrobe writes share the Creator operation lock");

const manager = slurp2Source(
  "packages/slurp2/src/engine/packages/client/src/slp/features/creators/SlpWardrobeManager.tsx",
);
assert.match(manager, /Only selected entries/u);
assert.match(manager, /entryIds: lorebookEntryIds/u);

console.log("slurp2 wardrobe regression checks passed");
