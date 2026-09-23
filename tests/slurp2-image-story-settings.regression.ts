import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source";

const root = "packages/slurp2/src/engine/packages";
const read = (path: string) => slurp2Source(`${root}/${path}`);

const storage = read("server/src/services/storage/slurp.storage.ts");
const generation = read("server/src/services/slurp/slurp-generation.service.ts");
const automation = read("client/src/components/slurp/SlurpBackstageAutomation.tsx");
const home = read("client/src/components/slurp/SlurpHome.tsx");
const backstage = read("client/src/components/slurp/slurp-backstage.ts");
const english = JSON.parse(read("client/src/localization/locales/en.json")) as Record<string, string>;

assert.match(storage, /storyImagesEnabled: z\.boolean\(\)/u);
assert.match(storage, /storyLifetimeHours: z\.number\(\)\.int\(\)\.min\(1\)\.max\(168\)/u);
assert.match(storage, /storyImagesEnabled: true,\s*storyLifetimeHours: 72,/u);
assert.match(generation, /input\.allowStory !== false && variation\?\.story === true && settings\.storyImagesEnabled/u);
assert.match(generation, /settings\.storyImagesEnabled \? settings\.storyRate : "off"/u);
assert.match(
  generation,
  /input\.request\.postType === "story"\) &&\s*imagesEnabled/u,
  "manual Story posts must still use the image path",
);
assert.match(automation, /settingKey="storyImagesEnabled"/u);
assert.match(automation, /settingKey="storyLifetimeHours"/u);
assert.match(automation, /settingKey="storyImageWidth"[\s\S]*settingKey="storyImageHeight"/u);
assert.match(home, /storyLifetimeHours \* 60 \* 60 \* 1000/u);
assert.doesNotMatch(home, /SLURP_MOMENT_WINDOW_MS/u);
assert.match(backstage, /storyRate: automation\("general", "story posts", "story rate"\)/u);
assert.match(backstage, /arcLibrary: content\("arcs", "plan templates", "stories"\)/u);
assert.equal(english["ui.slurp.settings.storyRate"], "Story posts");
for (const key of [
  "ui.slurp.settings.storyImagesEnabled",
  "ui.slurp.settings.storyImagesEnabledDetail",
  "ui.slurp.settings.storyLifetimeHours",
  "ui.slurp.settings.storyLifetimeHoursDetail",
]) {
  assert.equal(typeof english[key], "string", `${key} needs an English string`);
}

console.log("slurp2 image Story settings regression passed");
