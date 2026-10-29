// Drive the actual image builders and fake paid clients with a long authored Appearance and a stale cached look.
// Every persona image keeps the whole current Appearance, each action adds its own outfit, and no real provider runs.
import assert from "node:assert/strict";
import test from "node:test";
import { paintCgNow } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/cg.ts";
import {
  paintItemNow,
  paintPairNow,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/outfits.ts";
import { paintClaimed } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/art/paint.ts";
import {
  bannerId,
  itemId,
  playerId,
  runDocTarget,
  stateId,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/ids.ts";
import { normalizePlayer } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/player.ts";
import { normalizeState } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/state.ts";
import {
  normalizeBanner,
  normalizeItem,
} from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/schemas/wish.ts";
import { readPersona } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/setup/prompts.ts";
import { paintBannerArtNow } from "../packages/otome-forge/src/engine/packages/server/src/services/otome-forge/wish/banners.ts";
import { artWorld, beat, KEY, saveBeat, seedChapter } from "./fixtures/otome-forge-art.ts";
import { KAI } from "./fixtures/otome-forge-story.ts";

const APPEARANCE = `APPEARANCE-START ${"auburn braid, amber eyes, freckles, copper prosthetic hand, ".repeat(50)}APPEARANCE-END`;

for (const [i, scenario] of [
  { name: "whole long Appearance", available: true, appearance: APPEARANCE, cached: "STALE-INVENTED-IDENTITY" },
  { name: "cleared Appearance", available: true, appearance: "", cached: APPEARANCE },
  {
    name: "disabled override A with inactive text changed to B",
    available: true,
    appearance: "",
    cached: "OLD-OVERRIDE-A",
  },
  {
    name: "an unavailable persona's own saved fallback",
    available: false,
    appearance: "",
    cached: "UNAVAILABLE-SAVED-IDENTITY",
  },
].entries())
  test(`every persona image follows ${scenario.name}, retains outfit changes, and uses no invented description`, async () => {
    const t = await artWorld({ runKey: `r-personaart${i}-aaaaaa`, images: { ask: true } });
    t.runtime.resources.listPersonas = async (ids) => {
      assert.deepEqual(ids, ["persona-ines"]);
      if (!scenario.available) return [];
      return [
        {
          id: "persona-ines",
          data: {
            appearance: scenario.appearance,
            description: "NARRATIVE-NOT-APPEARANCE",
            imageAppearanceEnabled: false,
            imageAppearance: "INACTIVE-OVERRIDE-B",
          },
        },
      ];
    };
    t.images.generateOutfit = t.images.generatePortrait;
    const restoreCachedIdentity = () =>
      t.store.updateDoc(runDocTarget("player", playerId(t.runId)), normalizePlayer, (player) => ({
        ...player,
        look: { identityLine: scenario.cached, outfitLine: "old travel coat" },
      }));
    const her = normalizeItem({
      id: "my-wardrobe-0-f",
      banner: "my-wardrobe-0",
      kind: "her-look5",
      title: "Her new look",
      coupleWith: "his-wardrobe-0-f",
      look: { name: "New look", outfitLine: "OUTFIT-DELTA amber silk dress" },
    });
    const four = normalizeItem({ ...her, id: "my-wardrobe-0-a1", kind: "her-look4" });
    const his = normalizeItem({
      id: "his-wardrobe-0-f",
      banner: "his-wardrobe-0",
      kind: "his-look5",
      li: KAI,
      title: "His look",
      look: { name: "His look", outfitLine: "blue coat" },
      art: { state: "ready", at: "now", url: "/his-look.png" },
    });
    for (const item of [her, four, his]) {
      await t.store.mutateDoc(runDocTarget("item", itemId(t.runId, item.id)), normalizeItem, () => item);
    }
    await t.store.mutateDoc(runDocTarget("banner", bannerId(t.runId, "my-wardrobe-0")), normalizeBanner, () =>
      normalizeBanner({
        key: "my-wardrobe-0",
        kind: "my-wardrobe",
        featuredLi: KAI,
        items: {
          five: [her.id],
          four: [four.id, "my-wardrobe-0-a2", "my-wardrobe-0-a3"],
          three: Array.from({ length: 6 }, (_, i) => `my-wardrobe-0-s${i + 1}`),
        },
      }),
    );
    await t.store.updateDoc(runDocTarget("state", stateId(t.runId)), normalizeState, (state) => ({
      ...state,
      owned: { ...state.owned, items: [her.id, his.id, four.id] },
    }));
    await seedChapter(t.store, t.runId);
    await saveBeat(
      t.store,
      t.runId,
      beat(1, { places: [], cg: { at: 0, brief: "The protagonist reads a letter.", cast: ["Ines"] } }),
    );

    for (const paint of [
      () => paintClaimed(t.deps, t.runId, "player", { debugMode: false }),
      () => paintItemNow(t.deps, t.runId, four.id, { debugMode: false }),
      () => paintBannerArtNow(t.deps, t.runId, "my-wardrobe-0", { debugMode: false }),
      () => paintCgNow(t.deps, t.runId, KEY, 1, { debugMode: false }),
      () => paintPairNow(t.deps, t.runId, her.id, { debugMode: false }),
    ]) {
      await restoreCachedIdentity();
      assert.equal((await paint())?.state, "ready");
    }
    assert.equal(t.paid.length, 5);
    for (const [i, call] of t.paid.entries()) {
      const expected = scenario.available ? scenario.appearance : scenario.cached;
      if (expected) {
        assert.ok(
          call.request.prompt.includes(expected),
          `image path ${i} sends Appearance without trimming its length`,
        );
      } else {
        assert.doesNotMatch(call.request.prompt, /APPEARANCE-START|APPEARANCE-END/);
      }
      assert.doesNotMatch(
        call.request.prompt,
        /STALE-INVENTED-IDENTITY|OLD-OVERRIDE-A|INACTIVE-OVERRIDE-B|NARRATIVE-NOT-APPEARANCE/,
      );
    }
    for (const i of [1, 2, 4]) assert.match(t.paid[i]!.request.prompt, /OUTFIT-DELTA amber silk dress/);
    for (const i of [0, 1, 2]) assert.match(t.paid[i]!.request.prompt, /plain flat solid chroma/);
    assert.equal(
      t.calls.length,
      0,
      "a readable persona, including empty Appearance, needs no model-written substitute",
    );
  });

test("image Appearance overrides apply only while enabled; an inactive override never replaces empty Appearance", async () => {
  for (const [enabled, appearance, expected] of [
    [true, APPEARANCE, "ENABLED-IMAGE-APPEARANCE"],
    [false, APPEARANCE, APPEARANCE],
    [false, "", ""],
  ] as const) {
    const runtime = {
      resources: {
        listPersonas: async () => [
          {
            id: "persona",
            data: { appearance, imageAppearance: "ENABLED-IMAGE-APPEARANCE", imageAppearanceEnabled: enabled },
          },
        ],
      },
    };
    const persona = await readPersona(runtime as never, "persona");
    assert.equal(persona?.appearance, expected);
  }
});
