/** Opening day's phone preview (docs/OPENING-DAY.md, "What each answer does to the phone"): answers → view. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  SLP_PHONE_REGIONS,
  slpPhoneCreatorNameKey,
  slpPhonePreview,
  type SlpPhonePost,
  type SlpPhonePreviewInput,
  type SlpPhonePreviewView,
} from "../packages/slurp2/src/engine/packages/client/src/slp/modules/preview/slp-phone-preview.ts";

const root = "packages/slurp2/src/engine/packages/client/src/slp";
const en = JSON.parse(readFileSync(`${root}/locales/en.json`, "utf8")) as Record<string, string>;
const view = (patch: Partial<SlpPhonePreviewInput> = {}) =>
  slpPhonePreview({ creators: true, locked: false, ...patch });
const posts = (v: SlpPhonePreviewView) => v.items.filter((item): item is SlpPhonePost => item.kind === "post");
const ads = (v: SlpPhonePreviewView) => v.items.filter((item) => item.kind === "sponsored");

// Empty: no Creators yet, nothing in the feed, the chip still says the place opens soon.
const empty = slpPhonePreview({ creators: false, locked: true, ads: "lots", drama: "bringIt" });
assert.deepEqual(empty.items, []);
assert.equal(empty.gossip, null);
assert.equal(empty.empty?.titleKey, "ui.slurp.opening.preview.empty.title");
assert.equal(empty.top.chipKey, "ui.slurp.opening.preview.soon");

// Defaults: Mari alone, neutral caption, no comment, no ads, no gossip, no moon, no footer, no badge.
const plain = view();
assert.equal(plain.empty, null);
assert.equal(posts(plain).length, 1);
assert.equal(posts(plain)[0]!.captionKey, "ui.slurp.opening.preview.caption.mari.default");
assert.equal(posts(plain)[0]!.comment, null);
assert.equal(posts(plain)[0]!.picture, true);
assert.equal(posts(plain)[0]!.nameKey, "ui.slurp.opening.preview.creator.mari.own");
assert.equal(ads(plain).length, 0);
assert.equal(plain.gossip, null);
assert.equal(plain.hintKey, null);
assert.deepEqual(plain.top, { chipKey: "ui.slurp.opening.preview.soon", fans: null, moon: false });
assert.deepEqual(plain.footer, []);
assert.equal(plain.stirBadge, false);

// Locked: only Mari's first post, until she is unlocked.
assert.equal(posts(view({ locked: true, pace: "lively" }))[0]!.locked, true);
assert.ok(
  posts(view({ locked: true, pace: "lively" }))
    .slice(1)
    .every((p) => !p.locked),
);
assert.equal(posts(view({ locked: false }))[0]!.locked, false);

// pace: 1 (with the "posts when you ask" hint), 2, 3, 4, and grows 3.
const pace = { manual: 1, occasional: 2, lively: 3, veryActive: 4, grows: 3 } as const;
for (const [value, count] of Object.entries(pace)) {
  const v = view({ pace: value as keyof typeof pace });
  assert.equal(posts(v).length, count, value);
  assert.equal(v.hintKey, value === "manual" ? "ui.slurp.opening.preview.manual" : null, value);
  assert.deepEqual(
    posts(v).map((p) => p.creator),
    [...Array(count).keys()],
  );
}

// pictures; imageConnection only shows with pictures on.
assert.ok(posts(view({ pace: "veryActive", pictures: "yes" })).every((p) => p.picture));
assert.ok(posts(view({ pace: "veryActive", pictures: "no" })).every((p) => !p.picture));
assert.deepEqual(view({ connectionName: "GLM 5.2", imageConnectionName: "Flux" }).footer, [
  { key: "ui.slurp.opening.preview.writtenBy", name: "GLM 5.2" },
  { key: "ui.slurp.opening.preview.picturesBy", name: "Flux" },
]);
assert.deepEqual(view({ pictures: "no", imageConnectionName: "Flux" }).footer, []);

// spice: Mari's caption and the locked blur.
for (const [spice, blur] of [
  ["clean", "soft"],
  ["flirty", "soft"],
  ["suggestive", "medium"],
  ["explicit", "strong"],
] as const) {
  const first = posts(view({ spice, locked: true }))[0]!;
  assert.equal(first.captionKey, `ui.slurp.opening.preview.caption.mari.${spice}`);
  assert.equal(first.blur, blur);
}

// names: hinted = stage names, everywhere a Creator is named.
assert.ok(posts(view({ pace: "veryActive", names: "hinted" })).every((p) => p.nameKey.endsWith(".stage")));
assert.ok(posts(view({ pace: "veryActive", names: "open" })).every((p) => p.nameKey.endsWith(".own")));

// nights: the moon.
assert.equal(view({ nights: "yes" }).top.moon, true);
assert.equal(view({ nights: "no" }).top.moon, false);

// fans: the comment under the first post only.
for (const fans of ["warm", "mixed", "unfiltered"] as const) {
  const [first, second] = posts(view({ fans, pace: "occasional" }));
  assert.equal(first!.comment?.textKey, `ui.slurp.opening.preview.comment.${fans}.text`);
  assert.equal(second!.comment, null);
}

// size: the fan chip and the like counts.
const sizes = { intimate: 312, normal: 12_400, large: 1_200_000 } as const;
for (const [size, fans] of Object.entries(sizes)) {
  const v = view({ size: size as keyof typeof sizes });
  assert.deepEqual(v.top, { chipKey: "ui.slurp.opening.preview.fans", fans, moon: false });
}
const likes = (size: keyof typeof sizes) => posts(view({ size }))[0]!.likes;
assert.ok(likes("intimate") < likes("normal") && likes("normal") < likes("large"));

// drama: none / a light banner / a loud one, on top of the feed.
assert.equal(view({ drama: "none" }).gossip, null);
assert.equal(view({ drama: "sometimes" }).gossip?.level, "light");
assert.equal(view({ drama: "bringIt" }).gossip?.level, "loud");

// ads: 0 / 1 / 2 sponsored cards, also when the feed is short; adTone sets the copy.
for (const [value, count] of [
  ["none", 0],
  ["few", 1],
  ["lots", 2],
] as const)
  for (const p of ["manual", "veryActive"] as const) assert.equal(ads(view({ ads: value, pace: p })).length, count);
assert.deepEqual(
  view({ ads: "lots", pace: "lively" }).items.map((item) => item.kind),
  ["post", "sponsored", "post", "sponsored", "post"],
);
assert.ok(ads(view({ ads: "lots", adTone: "unhinged" })).every((ad) => ad.textKey.endsWith(".unhinged")));
assert.ok(ads(view({ ads: "lots" })).every((ad) => ad.tone === "normal"));

// pullStrings: the Support desk badge on Stir.
assert.equal(view({ pullStrings: "platform" }).stirBadge, true);
assert.equal(view({ pullStrings: "fair" }).stirBadge, false);

// Every key the view (and the component) can name exists in en.json.
const named = new Set<string>();
const collect = (v: SlpPhonePreviewView) => {
  named.add(v.top.chipKey);
  if (v.empty) named.add(v.empty.titleKey).add(v.empty.bodyKey);
  if (v.gossip) named.add(v.gossip.textKey);
  if (v.hintKey) named.add(v.hintKey);
  for (const line of v.footer) named.add(line.key);
  for (const item of v.items)
    if (item.kind === "post") {
      named.add(item.nameKey).add(item.captionKey);
      if (item.comment) named.add(item.comment.nameKey).add(item.comment.textKey);
    } else named.add(item.brandKey).add(item.textKey);
};
collect(empty);
for (const names of ["hinted", "open"] as const)
  for (const spice of [undefined, "clean", "flirty", "suggestive", "explicit"] as const)
    for (const fans of ["warm", "mixed", "unfiltered"] as const)
      for (const adTone of ["normal", "unhinged"] as const)
        for (const drama of ["sometimes", "bringIt"] as const)
          collect(
            view({
              names,
              spice,
              fans,
              adTone,
              drama,
              ads: "lots",
              pace: "veryActive",
              size: "large",
              connectionName: "A",
              imageConnectionName: "B",
            }),
          );
collect(view({ pace: "manual" }));
for (let creator = 0; creator < 4; creator++)
  named.add(slpPhoneCreatorNameKey(creator, "hinted")).add(slpPhoneCreatorNameKey(creator, "open"));
const component = readFileSync(`${root}/modules/preview/SlpPhonePreview.tsx`, "utf8");
for (const [literal] of component.matchAll(/ui\.slurp\.opening\.preview\.[\w.]+/gu)) named.add(literal);
for (const key of named) assert.ok(typeof en[key] === "string" && en[key]!.length > 0, `en.json misses ${key}`);
// And nothing in the block is unused.
for (const key of Object.keys(en).filter((k) => k.startsWith("ui.slurp.opening.preview.")))
  assert.ok(named.has(key), `${key} is never shown`);

// Every answer the plan names has a region to glow.
for (const answer of ["pace", "pictures", "spice", "names", "nights", "fans", "size", "drama", "ads", "adTone"])
  assert.ok(SLP_PHONE_REGIONS[answer], answer);
for (const answer of ["pullStrings", "connection", "imageConnection", "locked"]) assert.ok(SLP_PHONE_REGIONS[answer]);

console.log("slurp2 phone preview regression passed");
