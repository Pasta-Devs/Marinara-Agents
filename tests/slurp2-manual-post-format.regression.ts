import assert from "node:assert/strict";
import { slpCreatorPostCreateWithMediaSchema } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-social.schema.js";
import { slpCreatorGenerationRequestSchema } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-social-generation.schema.js";
import { slurp2Source } from "./slurp2-source";

const routes = slurp2Source("packages/slurp2/src/engine/packages/server/src/slp/features/feed/slp-feed-post-routes.ts");
assert.match(routes, /slurpCreatorPostCreateWithMediaSchema/u, "manual post routes must use the shared create schema");

for (const format of ["caption", "announcement", "long_form"] as const) {
  const parsed = slpCreatorPostCreateWithMediaSchema.safeParse({
    targetAccountId: "creator",
    title: "A live post",
    content: "Post body",
    access: "public",
    format,
  });
  assert.equal(parsed.success, true, `${format} manual posts must pass the request schema`);

  const guided = slpCreatorGenerationRequestSchema.safeParse({
    mode: "noodler",
    targetAccountId: "creator",
    access: "public",
    format,
  });
  assert.equal(guided.success, true, `${format} guided posts must pass the generation schema`);
}

const invalid = slpCreatorPostCreateWithMediaSchema.safeParse({
  targetAccountId: "creator",
  title: "A live post",
  content: "Post body",
  access: "public",
  format: "unsupported",
});
assert.equal(invalid.success, false, "unknown post formats must still be rejected");
const invalidGuided = slpCreatorGenerationRequestSchema.safeParse({
  mode: "noodler",
  targetAccountId: "creator",
  access: "public",
  format: "unsupported",
});
assert.equal(invalidGuided.success, false, "unknown guided post formats must still be rejected");

console.log("slurp2 manual post format regression passed");
