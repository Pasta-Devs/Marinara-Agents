import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
// Exercise the actual narrow legacy adapter, retaining the provider calls as a controlled seam.
const source = await readFile(
  new URL("../packages/gacha-forge/src/seasonal-events-adapter.mjs", import.meta.url),
  "utf8",
);
async function check({ enabled = true, disableAfterBanner = false } = {}) {
  let config,
    banners = 0,
    outfits = 0,
    tags = 0;
  const run = { story: { seasonalEvents: enabled }, images: { off: false } };
  const noop = () => {};
  const context = {
    Date,
    structuredClone,
    console,
    n: { id: "gacha-forge" },
    a: {},
    r: { persistence: {}, logger: { warn: noop } },
    be: async () => ({ data: run }),
    Ae: (data) => data,
    pe: async () => ({ data: {} }),
    forgeSeasonalEnabled: (value) => value.story.seasonalEvents === true,
    nt: (value) => value.images,
    nn: async () => ({ id: "image", provider: "controlled", model: "fixture" }),
    Gn: async () => ({ name: "Arden" }),
    ch: async () => {
      tags++;
      return { name: "Arden" };
    },
    vn: (id) => id,
    Le: () => ({
      generateBannerArt: async () => {
        banners++;
        if (disableAfterBanner) run.story.seasonalEvents = false;
        return { prompt: "poster" };
      },
      generateOutfit: async () => {
        outfits++;
        return { prompt: "outfit" };
      },
      uploadToGallery: async () => ({ id: "fixture", url: "/fixture.webp" }),
    }),
    xn: async (_run, apply) => {
      apply({});
      return true;
    },
    forgeAddCalendarDays: noop,
    forgeWallDate: noop,
    tr: noop,
    forgeChoices: {},
    ie: noop,
    cc: noop,
    createForgeSeasonalEvents: (value) => ((config = value), {}),
    forgeStoryPost: noop,
  };
  vm.runInNewContext(source + ";createForgeSeasonalLegacyAdapter();", context);
  const reward = { kind: "outfit", nodeIndex: 9, unitId: "world:unit:arden", name: "Festival coat", prompt: "coat" };
  const media = await config.prepareMedia({
    runId: "world",
    event: {
      seq: 1,
      title: "Lantern Crossing",
      endsAt: Date.now() + 100000,
      cast: [reward.unitId],
      rewards: [reward],
      musicPrompt: "lantern strings",
    },
  });
  return { banners, outfits, tags, media };
}
const disabled = await check({ enabled: false });
assert.equal(disabled.banners, 0);
assert.equal(disabled.tags, 0);
assert.equal(disabled.outfits, 0);
assert.equal(disabled.media.rewards[0].kind, "aether");
const raced = await check({ disableAfterBanner: true });
assert.equal(raced.banners, 1);
assert.equal(raced.outfits, 0, "Opt-out between banner and outfit must prevent the second paid image call");
assert.equal(raced.media.rewards[0].kind, "aether");
const enabled = await check();
assert.equal(enabled.banners, 1);
assert.equal(enabled.outfits, 1);
console.info(JSON.stringify({ pass: true, disabledNoCalls: true, optOutBetweenImages: true }));
