import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source";

const read = (path: string) => slurp2Source(`packages/slurp2/src/engine/packages/${path}`);

const rewrite = read("server/src/slp/base/media/slp-image-prompt-rewrite.ts");
const imageService = read("server/src/slp/features/media/slp-images-service.ts");
const publicImageService = read("server/src/slp/features/media/slp-public-images-service.ts");
const messageService = read("server/src/slp/features/messages/slp-message-generation-service.ts");
const settings = read("server/src/slp/modules/settings/slp-settings.ts");
const brief = read("server/src/slp/base/media/slp-visual-brief.ts");
const briefBuilder = read("server/src/slp/modules/feed/slp-visual-brief.ts");
const preview = read("client/src/slp/features/settings/SlpPromptPreviewInspector.tsx");

assert.match(rewrite, /postContent\?: string/u);
assert.match(rewrite, /<post_context>/u);
assert.match(rewrite, /Do not increase the sexual intensity/u);
assert.match(imageService, /postContent: input\.postContent/u);
assert.match(publicImageService, /postContent: input\.postContent/u);
assert.match(messageService, /Keep the image inside the Creator content menu and relationship boundaries/u);
assert.match(settings, /LEGACY_GRAPHIC_SLP_CREATOR_DEFAULT_IMAGE_GENERATION_PROMPT/u);
assert.match(settings, /record\.id === "image-style"/u);
assert.match(settings, /record\.text === LEGACY_GRAPHIC_SLP_CREATOR_DEFAULT_IMAGE_GENERATION_PROMPT/u);
assert.match(settings, /Do not turn an ordinary update into a fashion shoot or erotic image/u);
assert.match(brief, /sexualLevel: SlurpVisualSexualLevel/u);
assert.match(brief, /visual brief is authoritative/u);
assert.match(briefBuilder, /sexualLevel: intent === "teaser"/u);
assert.match(brief, /slurpVisualBriefPromptViolatesPolicy/u);
assert.match(preview, /Runtime data can add more context during generation/u);
assert.match(preview, /runs the post generator with the selected Creator/u);

console.log("slurp2 image prompt boundaries regression passed");
