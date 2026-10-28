/**
 * The guided post (0.3.14): one line drafts a post for review on every page, and Stir never posts a
 * "write a post" card directly; it hands the idea to the page's composer.
 */
import assert from "node:assert/strict";
import { SLP_ACTION_META, SLP_ACTIONS } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-actions";
import { slurp2Source } from "./slurp2-source";

const engine = (path: string) =>
  slurp2Source(new URL(`../packages/slurp2/src/engine/packages/${path}`, import.meta.url));

// The action: an idea in, a draft out; never a Stir deck card, never posting anything.
const draft = SLP_ACTIONS["draft-post"].schema;
assert.equal(draft.safeParse({ accountId: "a", idea: "" }).success, false, "An idea is required");
assert.deepEqual(draft.parse({ accountId: "a", idea: "gym selfie" }), {
  accountId: "a",
  idea: "gym selfie",
  story: false,
  access: "public",
  picture: true,
});
assert.equal(draft.safeParse({ accountId: "a", idea: "x", access: "subscribers" }).success, false);
assert.equal(
  draft.parse({ accountId: "a", idea: "x", access: "locked", lookId: "l", projectId: "p" }).access,
  "locked",
);
assert.equal(SLP_ACTION_META["draft-post"].deck, false);

const service = engine("server/src/slp/features/assist/slp-assist-service.ts");
assert.match(service, /export async function draftSlpPost/u);
assert.doesNotMatch(
  service.slice(service.indexOf("export async function draftSlpPost")),
  /generateAndApplyCreatorPost|createNoodlerPost|publish/u,
  "A draft posts nothing",
);
assert.match(service, /That brand deal is not this page's/u, "A deal from another page is refused");
// 0.3.31: the draft is the page's normal post, written by the post generator in draft mode with the
// wish as its direction. Its picture is drawn from the image prompt the post wrote, not from the wish.
const drafting = service.slice(service.indexOf("export async function draftSlpPost"));
assert.match(
  drafting,
  /generateCreatorPost\(db, \{[\s\S]*?prepareOnly: true,\s*previewOnly: true,[\s\S]{0,160}?skipImagePromptPreview: true,/u,
  "the normal generator, with nothing saved",
);
assert.match(drafting, /access: input\.access,/u, "the audience picked in the composer decides the guidance");
assert.match(drafting, /noodlerPostGuide: \[wish, extra\]/u, "the wish is the post direction");
assert.match(drafting, /request: post\.imagePrompt \?\? "",/u, "the picture comes from the post's own image prompt");
assert.doesNotMatch(drafting, /runSlpAssistText|request: input\.idea/u, "never the small Write prompt or the raw wish");
assert.match(drafting, /That storyline is not this page's/u);
assert.match(drafting, /That look is not in this page's wardrobe/u);
assert.match(drafting, /\{ access: input\.access \}/u, "a public draft draws at the public level");

// Stir: review for everyone, so a write-post card is always a draft hand-over.
const preview = engine("server/src/slp/features/assist/slp-action-preview.ts");
assert.match(preview, /case "write-post": \{[\s\S]{0,400}?error: "draftInComposer"/u);
const cards = engine("client/src/slp/features/stir/SlpStirCards.tsx");
assert.match(cards, /card\.action === "write-post" && card\.error === "draftInComposer"/u);
assert.match(cards, /setComposeGuide\(\{ accountId: a\.id, idea:/u);

// The composer: the guide sits in the one composer, and an owed #ad settles once posted.
const composer = engine("client/src/slp/app/screens/SlpScreenComposer.tsx");
assert.match(composer, /<SlpPostGuide/u);
assert.match(
  composer,
  /if \(guideDealId\.current && viewerPersonaId\) markDealPosted\.mutate\(guideDealId\.current\)/u,
);
console.log("slurp2 guided post: ok");
