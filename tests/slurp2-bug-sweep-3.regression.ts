/**
 * Bug sweep 3 (0.3.64): reported Slurp bugs, each pinned where it was fixed.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { slurpDmRoleHeader } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-dm-roles.ts";
import { slurp2Source } from "./slurp2-source.ts";

const server = (path: string) => slurp2Source(`packages/slurp2/src/engine/packages/server/src/slp/${path}`);
const client = (path: string) => slurp2Source(`packages/slurp2/src/engine/packages/client/src/slp/${path}`);

// The Creator in a DM knows what the player's open page posted lately.
const page = { name: "Mira Vale", handle: "miravale", recentPosts: ["Beach day", "New set tonight"] };
const header = slurpDmRoleHeader({
  writer: "creator",
  creator: { name: "Lena Hart", handle: "lenahart" },
  viewer: { name: "Mira", handle: "mira" },
  viewerPage: page,
  history: [],
});
assert.match(header, /Latest posts on Mira Vale \(@miravale\): "Beach day" "New set tonight"/u);
assert.doesNotMatch(
  slurpDmRoleHeader({ writer: "creator", creator: page, viewer: { name: "Mira", handle: "mira" }, history: [] }),
  /Latest posts/u,
  "no page, no posts",
);
assert.match(
  server("features/projects/slp-creator-couples-service.ts"),
  /filter\(\(post\) => post\.access === "public" && post\.content\.trim\(\)\)/u,
  "only public posts with words reach the prompt",
);

// A tag-list look ("blonde, freckles, red dress") keeps its clothes; only prose drops the clothing sentences.
const prompt = server("base/media/slp-image-prompt.ts");
const tagList = new RegExp(prompt.match(/const TAG_LIST = \/(.+)\/u;/u)![1]!, "u");
assert.ok(tagList.test("blonde, freckles, red dress"));
assert.ok(!tagList.test("She is blonde. She wears a red dress, boots, and a hat."));
assert.match(prompt, /TAG_LIST\.test\(text\)\s*\? text\s*:/u);

// A local model that wraps the one arc in a list still yields the arc.
assert.match(
  server("features/projects/slp-arc-generation-service.ts"),
  /Array\.isArray\(answer\) && answer\.length === 1 \? answer\[0\] : answer/u,
);

// A Creator tagged with @handle in a post is cast in its picture.
const generation = server("features/feed/slp-generation-service.ts");
assert.equal((generation.match(/resolveSlurpMentionedCast\(/gu) ?? []).length, 2, "guide and post text");
assert.match(
  generation,
  /resolveSlurpMentionedCast\(db, account\.id, protectedGenerated\.content, false\)/u,
  "a caption tag never casts the player",
);

// A reasoning model gets room to think and still write the picture prompt.
assert.match(server("base/media/slp-image-prompt-rewrite.ts"), /resolveStoredMaxTokens\([^)]*8_192\), 8_192\)/u);

// Commas can be typed in wardrobe tags.
assert.match(client("features/creators/SlpWardrobeManager.tsx"), /onBlur=/u);

// "Keep original picture files" (Advanced, off by default) skips the WebP re-encode, so ComfyUI metadata stays.
assert.match(server("base/media/slp-media.ts"), /if \(keepOriginal \|\| \(ext !== "png" && ext !== "bmp"\)\) return/u);
assert.match(server("modules/settings/slp-settings.ts"), /imageKeepOriginalFiles: false,/u);
assert.match(
  client("features/media/SlpImagesPanel.tsx"),
  /settingKey="imageKeepOriginalFiles"[\s\S]*?<\/AdvancedGroup>/u,
);

// The Engine's Modal panel is in the package style scope, so a fixed panel height applies and the window does not grow.
assert.match(
  readFileSync(new URL("../scripts/build-feature-packages.mjs", import.meta.url), "utf8"),
  /@scope \(marinara-capability-\$\{capabilityId\}, \$\{scopeAttribute\}, \.mari-modal:has\(\$\{scopeAttribute\}\)\)/u,
);

console.log("slurp2 bug sweep 3: ok");
