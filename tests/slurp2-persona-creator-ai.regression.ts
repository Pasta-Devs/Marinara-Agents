import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source";

/**
 * Persona-sourced Creators had no drafting tools: the generator refused them outright, so the
 * composer's Guide button answered 404 and images could only be uploaded. Nothing writes for them
 * unattended, but their owner may ask.
 */
const server = "packages/slurp2/src/engine/packages/server/src/";
const client = "packages/slurp2/src/engine/packages/client/src/";
const read = (path: string) => slurp2Source(path);

const postOperation = read(`${server}services/slurp/slurp-post.operation.ts`);
assert.match(
  postOperation,
  /account\.kind === "persona" && account\.sourceKind === "persona" && admissionMode\?\.kind !== "foreground"/u,
  "only a foreground request from the owner may draft for a persona-sourced Creator",
);
// The automatic paths still leave them out entirely.
assert.match(
  postOperation,
  /filter\(\(account\) => !\(account\.kind === "persona" && account\.sourceKind === "persona"\)\)/u,
);
const world = read(`${server}services/slurp/slurp-world.operation.ts`);
assert.match(world, /!\(account\.kind === "persona" && account\.sourceKind === "persona"\)/u);

// An asked-for image counts like the scheduler's own image setting.
const generation = read(`${server}services/slurp/slurp-generation.service.ts`);
assert.match(
  generation,
  /autoPosting\?\.imagesEnabled === true \|\| input\.request\.generateImage === true/u,
  "the composer toggle must enable an image prompt",
);
const routes = read(`${server}routes/slurp.routes.ts`);
assert.match(routes, /generateImage: z\.boolean\(\)\.optional\(\)/u);
assert.match(
  routes,
  /imagePrompt: z\.string\(\)\.trim\(\)\.max\(2000\)\.nullable\(\)\.optional\(\)/u,
  "a manual post may carry image directions",
);
assert.match(postOperation, /imagePrompt: input\.imagePrompt\?\.trim\(\) \|\| null/u);

// The composer offers the toggle, and a manual post renders its image after publishing.
const home = read(`${client}components/slurp/SlurpHome.tsx`);
assert.match(home, /ui\.slurp\.composer\.aiImage"/u);
assert.match(home, /const wantsImage = generateImage && !image;/u);
assert.match(home, /imagePrompt: body\.trim\(\) \|\| title\.trim\(\)/u);
assert.match(home, /generatePostImage\s*\.mutateAsync\(\{ id: created\.id, accountId: profileId \}\)/u);
assert.match(home, /\.\.\.\(generateImage \? \{ generateImage: true \} : \{\}\)/u, "a guided post forwards the toggle");

console.log("slurp2 persona creator AI regression passed");
