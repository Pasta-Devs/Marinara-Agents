/**
 * Two settings Slurp2 inherited from Noodle but never read, now wired:
 * - a Creator post that ends without a generated picture may use the source character's gallery image;
 * - Professor Mari may be picked as a new Creator source only while the Slurp setting allows it.
 */
import assert from "node:assert/strict";
import { slurp2BackstageSource } from "./slurp2-backstage-source";
import { slurp2Source } from "./slurp2-source";

const read = (path: string) => slurp2Source(`packages/slurp2/src/engine/packages/${path}`);
const generation = read("server/src/services/slurp/slurp-generation.service.ts");
const storage = read("server/src/services/storage/slurp.storage.ts");
const settingsView = slurp2BackstageSource();

// Gallery images are a fallback: gated on the setting and a character source, never an error.
assert.match(
  generation,
  /if \(!settings\.allowGalleryImageAttachments \|\| linkedPublicAccount\?\.kind !== "character"\) return \{\};/u,
);
assert.match(generation, /if \(!draftImagePrompt\) return \{ post: await persist\(await galleryFallback\(\)\)/u);
// Every no-picture outcome tries the gallery first: no connection, review failure, generation failure.
assert.equal(
  generation.match(
    /const fallback = await galleryFallback\(\);\s*if \(fallback\.imageUrl\) return \{ post: await persist\(fallback\)/gu,
  )?.length,
  3,
);
assert.match(settingsView, /update\("allowGalleryImageAttachments", value\)/u);
// Scheduled posts: the reserve attaches a gallery image when nothing was generated and nothing is
// still coming, and publishing uses it when there is no generated media.
const reserve = read("server/src/services/slurp/slurp-reserve.operation.ts");
assert.match(
  reserve,
  /settings\.allowGalleryImageAttachments &&\s*typeof payload\.metadata\.noodlerMediaPath !== "string" &&\s*payload\.metadata\.imageGenerationDeferred !== true/u,
);
assert.match(reserve, /galleryAttachmentImageUrl: attachment\.imageUrl/u);
assert.match(storage, /imageUrl: hasMedia \? noodlerPostMediaUrl\(postId\) : galleryImageUrl,/u);

// Professor Mari: one gate where new Creators and drafts resolve a source, plus the source list.
assert.match(
  storage,
  /async resolveSourceByEntityId\(sourceEntityId: string\)[\s\S]{0,400}?sourceEntityId === PROFESSOR_MARI_ID && !\(await this\.getSettings\(\)\)\.professorMariCreatorSource\) return null;/u,
);
assert.match(
  storage,
  /async listEligibleSources\(\)[\s\S]{0,400}?\.filter\(\(row\) => row\.id !== PROFESSOR_MARI_ID \|\| settings\.professorMariCreatorSource\)/u,
);
assert.match(storage, /professorMariCreatorSource: true,/u, "Mari stays available unless the player turns it off");
assert.match(settingsView, /update\("professorMariCreatorSource", value\)/u);

console.log("slurp2 gallery fallback and Professor Mari regression passed");
