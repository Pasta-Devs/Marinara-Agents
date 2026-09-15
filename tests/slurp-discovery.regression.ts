import assert from "node:assert/strict";
import {
  filterAndSortSlurpCreators,
  normalizeSlurpDiscoveryTags,
  type SlurpDiscoverCreator,
} from "../packages/slurp2/src/engine/packages/client/src/lib/slurp-discovery";

const creators: SlurpDiscoverCreator[] = [
  {
    profile: {
      id: "b",
      displayName: "Belle",
      handle: "belle",
      bio: "moon",
      createdAt: "2026-01-02",
      gender: "female",
      tags: ["cosplay", "gaming"],
    },
    subscribed: false,
    subscriptionPrice: 20,
    posts: [{ likeCount: 3 }, { likeCount: 2 }],
  },
  {
    profile: {
      id: "a",
      displayName: "Arlo",
      handle: "arlo",
      createdAt: "2026-01-03",
      gender: "male",
      tags: ["gaming"],
    },
    subscribed: true,
    subscriptionPrice: 5,
    posts: [{ likeCount: 9 }],
  },
  {
    profile: { id: "c", displayName: "Cinder", handle: "cinder", createdAt: "2026-01-01", gender: null, tags: [] },
    subscribed: false,
    subscriptionPrice: 20,
    posts: [],
  },
];
const base = {
  search: "",
  notSubscribed: false,
  genders: new Set<"male" | "female" | "other">(),
  tags: new Set<string>(),
  minimumPrice: null,
  maximumPrice: null,
  sort: "recommended" as const,
};
const counts = { a: { fans: 2 }, b: { fans: 12 }, c: { fans: 1 } };
const ids = (items: SlurpDiscoverCreator[]) => items.map((item) => item.profile.id);

assert.deepEqual(ids(filterAndSortSlurpCreators(creators, base, counts)), ["b", "a", "c"]);
assert.deepEqual(ids(filterAndSortSlurpCreators(creators, { ...base, notSubscribed: true }, counts)), ["b", "c"]);
assert.deepEqual(
  ids(filterAndSortSlurpCreators(creators, { ...base, genders: new Set(["female", "other"]) }, counts)),
  ["b"],
  "gender is OR within its group and unclassified profiles do not match an active gender filter",
);
assert.deepEqual(
  ids(filterAndSortSlurpCreators(creators, { ...base, tags: new Set(["cosplay", "art"]) }, counts)),
  ["b"],
  "tags are OR within their group",
);
assert.deepEqual(
  ids(filterAndSortSlurpCreators(creators, { ...base, minimumPrice: 20, maximumPrice: 20 }, counts)),
  ["b", "c"],
  "price bounds are inclusive",
);
assert.deepEqual(
  ids(filterAndSortSlurpCreators(creators, { ...base, search: "moon", notSubscribed: true }, counts)),
  ["b"],
  "search and filters combine with AND",
);
assert.deepEqual(ids(filterAndSortSlurpCreators(creators, { ...base, sort: "newest" }, counts)), ["a", "b", "c"]);
assert.deepEqual(ids(filterAndSortSlurpCreators(creators, { ...base, sort: "liked" }, counts)), ["a", "b", "c"]);
assert.deepEqual(ids(filterAndSortSlurpCreators(creators, { ...base, sort: "subscribed" }, counts)), ["b", "a", "c"]);
assert.deepEqual(normalizeSlurpDiscoveryTags(["  Sci‑Fi  ", "sci‑fi", "ＦＥＥＴ", "x".repeat(25)]), ["Sci‐Fi", "feet"]);

console.log("slurp discovery regression passed");
