/** Pool authoring, content gating, quality scoring, and export/import round-trip. */
import assert from "node:assert/strict";
import {
  exportGarnishAds,
  importGarnishAds,
  garnishExportSchema,
} from "../packages/slurp/src/engine/packages/server/src/services/garnish-ads/garnish-ads.export";
import { qualityScores } from "../packages/slurp/src/engine/packages/server/src/services/garnish-ads/garnish-ads.rating";
import { garnishRatingAllowed } from "../packages/slurp/src/engine/packages/server/src/services/garnish-ads/garnish-ads.types";
import type { GarnishAd } from "../packages/slurp/src/engine/packages/server/src/services/garnish-ads/garnish-ads.types";
import type { GarnishAdEvent } from "../packages/slurp/src/engine/packages/server/src/services/garnish-ads/garnish-ads.storage";

const ad = (id: string, over: Partial<GarnishAd> = {}): GarnishAd => ({
  id,
  platform: "slurp",
  kind: "inline",
  brand: `Brand ${id}`,
  product: "Thing",
  copy: "Copy.",
  categories: [],
  contextTags: [],
  contentRating: "tame",
  origin: "user",
  ...over,
});

// ── Content rating is a gate, ordered tame < suggestive < explicit ──
assert.equal(garnishRatingAllowed("tame", "tame"), true);
assert.equal(garnishRatingAllowed("explicit", "tame"), false);
assert.equal(garnishRatingAllowed("suggestive", "explicit"), true);
assert.equal(garnishRatingAllowed("explicit", "suggestive"), false, "a tighter ceiling must exclude explicit ads");

// ── Quality: new ads sit at zero until the trial is over ──
const impressions = (adId: string, count: number): GarnishAdEvent[] =>
  Array.from({ length: count }, () => ({ adId, subjectId: "s", type: "impression" as const, at: "now" }));

assert.equal(qualityScores(impressions("young", 7)).get("young"), 0, "an ad under trial must not be scored");
const hated = qualityScores([
  ...impressions("hated", 10),
  { adId: "hated", subjectId: "s", type: "hide", at: "now" },
  { adId: "hated", subjectId: "s", type: "hide", at: "now" },
]);
const loved = qualityScores([
  ...impressions("loved", 10),
  { adId: "loved", subjectId: "s", type: "action", at: "now" },
  { adId: "loved", subjectId: "s", type: "action", at: "now" },
]);
assert.ok(hated.get("hated")! < 0, "hides must push quality negative");
assert.ok(loved.get("loved")! > 0, "actions must push quality positive");
assert.ok(loved.get("loved")! > hated.get("hated")!);

// ── Export / import round-trip against an in-memory pool ──
function fakePool(ads: GarnishAd[], events: GarnishAdEvent[] = []) {
  return {
    async listAll(platform?: string) {
      return platform ? ads.filter((row) => row.platform === platform) : ads;
    },
    async listActive(platform: string) {
      return ads.filter((row) => row.platform === platform && !row.retiredAt);
    },
    async listEvents() {
      return events;
    },
    async replaceAll(next: GarnishAd[]) {
      ads = next;
    },
    async replaceEvents(next: GarnishAdEvent[]) {
      events = next;
    },
    read: () => ({ ads, events }),
  };
}

async function main() {
  const source = fakePool(
    [ad("a"), ad("b", { platform: "noodle" })],
    [{ adId: "a", subjectId: "s", type: "impression", at: "now" }],
  );

  const pack = await exportGarnishAds(source as never, "slurp");
  assert.equal(pack.version, 1);
  assert.deepEqual(
    pack.ads.map((row) => row.id),
    ["a"],
    "export must respect the platform partition",
  );
  assert.equal(pack.events.length, 1, "export must carry only events for the exported ads");
  garnishExportSchema.parse(pack);

  // merge keeps what is already there and overwrites by id
  const target = fakePool([ad("existing"), ad("a", { brand: "Old" })]);
  const merged = await importGarnishAds(target as never, pack, "merge");
  assert.equal(merged.imported, 1);
  assert.deepEqual(
    target.read().ads.map((row) => row.id),
    ["existing", "a"],
  );
  assert.equal(target.read().ads.find((row) => row.id === "a")?.brand, "Brand a", "import must overwrite by id");

  // replace swaps the whole pool
  const replaced = fakePool([ad("gone")]);
  await importGarnishAds(replaced as never, pack, "replace");
  assert.deepEqual(
    replaced.read().ads.map((row) => row.id),
    ["a"],
  );

  // a brand pack with no events must not wipe earned ratings
  const rated = fakePool([], [{ adId: "a", subjectId: "s", type: "action", at: "now" }]);
  await importGarnishAds(rated as never, { ...pack, events: [] }, "merge");
  assert.equal(rated.read().events.length, 1, "importing a brand pack must keep existing events");

  // re-importing the same backup must not double the events behind the quality scores
  const twice = fakePool([]);
  await importGarnishAds(twice as never, pack, "merge");
  await importGarnishAds(twice as never, pack, "merge");
  assert.equal(twice.read().events.length, pack.events.length, "merge must dedupe identical events");

  await assert.rejects(() => importGarnishAds(fakePool([]) as never, { version: 99, ads: [] }));

  console.log("garnish-ads pool: ok");
}

void main();
