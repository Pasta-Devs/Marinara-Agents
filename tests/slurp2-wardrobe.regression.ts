import assert from "node:assert/strict";
import {
  formatSlpWardrobeCloset,
  readSlpWardrobeLooks,
  slpWardrobeLookInputSchema,
  type SlpWardrobeLook,
} from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-wardrobe";
import {
  resolveSlurpWardrobeSelection,
  slurpPostCloset,
  slurpWardrobePrompt,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-wardrobe-selection";
import {
  buildSlpWardrobeImportMessages,
  parseSlpWardrobeImportDrafts,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-wardrobe-import";
import {
  buildSlpWardrobeJson,
  parseSlpWardrobeJson,
} from "../packages/slurp2/src/engine/packages/client/src/slp/features/creators/slp-wardrobe-json";
import { slurpPictureOutfit } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/feed/slp-image-brief";
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
    creatorName: "Mia",
  }).look?.id,
  "both-new",
);

const incompatible = resolveSlurpWardrobeSelection({
  looks,
  access: "public",
  scene: { wardrobeId: "locked", setting: "x", action: "x", expression: "x", visualDirection: "x" },
  recentIds: ["public-old"],
  creatorName: "Mia",
});
assert.equal(incompatible.look?.id, "both-new", "an incompatible choice falls back to the least-recent suitable look");
assert.equal(incompatible.requestedId, "locked");
assert.equal(incompatible.fallback, true);

assert.equal(
  resolveSlurpWardrobeSelection({ looks, access: "locked", recentIds: ["both-new"], creatorName: "Mia" }).look?.id,
  "locked",
  "a missing choice also avoids a recently used compatible look",
);
assert.doesNotMatch(formatSlpWardrobeCloset(looks), /disabled/u);
assert.match(slurpWardrobePrompt(looks, "public", ["both-new"], "Mia") ?? "", /public-old[\s\S]*both-new/u);

// A post that shows the body is offered only intimate looks, and no everyday look is a fallback.
const lingerie = {
  ...look("lingerie", "locked", "2026-06-01T00:00:00.000Z"),
  description: "black lace lingerie set",
};
const everyday = [bothNew, locked, publicOld];
const closet = (
  looks: SlpWardrobeLook[],
  level: "none" | "nudity" | "explicit",
  access: "public" | "locked" = "locked",
) => slurpPostCloset(looks, { level, access, scene: true });
assert.deepEqual(
  closet([...everyday, lingerie], "explicit").looks.map((entry) => entry.id),
  ["lingerie"],
);
assert.equal(closet(everyday, "explicit").bare, true);
assert.deepEqual(closet(everyday, "explicit").looks, []);
assert.equal(closet(everyday, "none").looks.length, 3, "other levels still offer every look");
assert.equal(
  closet(everyday, "explicit", "public").bare,
  false,
  "public posts never show nudity, so the closet is whole",
);
assert.deepEqual(slurpPostCloset(everyday, { level: "none", access: "locked", scene: false }).looks, []);
assert.equal(
  resolveSlurpWardrobeSelection({
    looks: closet(everyday, "explicit").looks,
    access: "locked",
    creatorName: "Mia",
    scene: { wardrobeId: "locked", setting: "x", action: "x", expression: "x", visualDirection: "x" },
  }).look,
  null,
);
const sportsBra = {
  ...look("gym", "locked", "2026-02-01T00:00:00.000Z"),
  name: "Gym day",
  description: "sports bra and lace-up shoes",
};
assert.deepEqual(
  closet([sportsBra, lingerie], "explicit").looks.map((entry) => entry.id),
  ["lingerie"],
  "only name and tags count",
);
assert.equal(
  resolveSlurpWardrobeSelection({ looks: [lingerie], access: "locked", creatorName: "Mia", bare: true }).look,
  null,
  "a body-showing post never gets a fallback look over the writer's outfit",
);
assert.equal(
  resolveSlurpWardrobeSelection({
    looks: [lingerie],
    access: "locked",
    creatorName: "Mia",
    bare: true,
    scene: { wardrobeId: "lingerie", setting: "x", action: "x", expression: "x", visualDirection: "x" },
  }).look?.id,
  "lingerie",
);
assert.equal(slurpWardrobePrompt(closet(everyday, "explicit").looks, "locked", [], "Mia"), null);
assert.match(
  slurpWardrobePrompt(closet([...everyday, lingerie], "explicit").looks, "locked", [], "Mia") ?? "",
  /lingerie/u,
);

// The picture's outfit: usual wardrobe is no fallback when the body shows; "nothing" adds no clothes line.
assert.equal(slurpPictureOutfit({ level: "explicit", usual: "hoodies and jeans" }), "");
assert.equal(slurpPictureOutfit({ level: "none", usual: "hoodies and jeans" }), "hoodies and jeans");
assert.equal(slurpPictureOutfit({ level: "nudity", scene: "Nothing, bare skin" }), "");
assert.equal(slurpPictureOutfit({ level: "suggestive", scene: "Nothing but a towel" }), "Nothing but a towel");
assert.equal(slurpPictureOutfit({ level: "explicit", selected: "lace lingerie", scene: "a sweater" }), "lace lingerie");

// Engine macros in a look resolve for the post; the stored look keeps its template.
const macroLook = {
  ...look("macro", "both", "2026-05-01T00:00:00.000Z"),
  summary: "{{random::red}} dress",
  description: "{{char}} wears a {{random::red}} dress",
};
assert.match(slurpWardrobePrompt([macroLook], "public", [], "Mia") ?? "", /\| red dress/u);
assert.equal(
  resolveSlurpWardrobeSelection({ looks: [macroLook], access: "public", creatorName: "Mia" }).look?.description,
  "Mia wears a red dress",
);
assert.match(macroLook.description, /\{\{char\}\}/u);

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
const untidy = parseSlpWardrobeImportDrafts(
  `<think>{"looks":[]}</think>\n{"outfits":[{"title":"Gala gown","description":"${"a long silk gown ".repeat(20)}","tags":"Formal, Evening","suitability":"Public","evidence":["wore a silk gown","to the gala"],"id":"x1"}]}`,
);
assert.equal(untidy.length, 1, "an untidy model reply still imports its look");
assert.equal(untidy[0]?.name, "Gala gown");
assert.deepEqual(untidy[0]?.tags, ["formal", "evening"]);
assert.equal(untidy[0]?.suitability, "public");
assert.ok((untidy[0]?.summary.length ?? 0) <= 180, "a long summary is clipped, not dropped");
const cut = parseSlpWardrobeImportDrafts(
  `{"looks":[{"name":"Gym set","summary":"grey {sports} set","description":"grey sports bra and shorts","tags":["gym"],"evidence":"her grey gym set"},{"name":"Rain coat","description":"a yellow rai`,
);
assert.deepEqual(
  cut.map((look) => look.name),
  ["Gym set"],
  "a reply cut at the token budget keeps the looks finished before the cut",
);
assert.deepEqual(
  parseSlpWardrobeImportDrafts(
    `[{"name":"Gym set","description":"grey sports bra and shorts","evidence":"her grey gym set"},{"name":"Rain`,
  ).map((look) => look.name),
  ["Gym set"],
  "a bare-array reply cut before its ] is salvaged too",
);
assert.deepEqual(
  parseSlpWardrobeImportDrafts(`{"looks":[{"name":"A","description":"b"}]}`),
  [],
  "a look without source evidence stays out",
);
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

const randomLook = {
  ...look("rnd", "both", "2026-01-01T00:00:00.000Z"),
  description: "wears {{random: red, blue}} boots",
};
const exported = buildSlpWardrobeJson([randomLook]);
const roundTrip = parseSlpWardrobeJson(exported);
assert.deepEqual(roundTrip.errors, []);
assert.equal(roundTrip.looks[0]?.description, randomLook.description);
assert.equal(roundTrip.looks[0] && "id" in roundTrip.looks[0], false);
assert.equal(parseSlpWardrobeJson(JSON.stringify(roundTrip.looks[0])).looks.length, 1);
assert.equal(parseSlpWardrobeJson(JSON.stringify([roundTrip.looks[0], { name: "x" }])).errors.length, 1);
assert.equal(parseSlpWardrobeJson("nope").looks.length, 0);
assert.equal(parseSlpWardrobeJson("5").errors.length, 1);

console.log("slurp2 wardrobe regression checks passed");
