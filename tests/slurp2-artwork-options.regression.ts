import assert from "node:assert/strict";

import { slurp2Source } from "./slurp2-source";

const root = "packages/slurp2/src/engine/packages/";
const editor = slurp2Source(`${root}client/src/slp/features/creators/SlpCreatorProfileEditor.tsx`);
const hook = slurp2Source(`${root}client/src/slp/features/creators/slp-creator-profile-hooks.ts`);
const route = slurp2Source(`${root}server/src/slp/features/media/slp-media-routes.ts`);
const operation = slurp2Source(`${root}server/src/slp/features/creators/slp-artwork-operation.ts`);
const generator = slurp2Source(`${root}server/src/slp/features/media/slp-images-service.ts`);

for (const option of ["creatorDetails", "appearance", "sourceReferences", "composition"]) {
  assert.match(editor, new RegExp(`key: "${option}"`), `${option} is selectable`);
  assert.match(route, new RegExp(`${option}: z\\.boolean\\(\\)`), `${option} is validated on the server`);
}
assert.match(editor, /type="checkbox"[\s\S]*checked=\{options\[option\.key\]\}/u);
assert.match(editor, /kind: artworkKind, guidance: guidance\.trim\(\) \|\| undefined, options/u);
assert.match(hook, /guidance,\s*options/u);
assert.match(operation, /postContent: options\.creatorDetails \? account\.bio : ""/u);
assert.match(operation, /suppressStageAppearance: !options\.appearance/u);
assert.match(operation, /suppressCreatorDetails: !options\.creatorDetails/u);
assert.match(operation, /suppressCharacterContext: !options\.sourceReferences/u);
assert.match(operation, /compositionGuard: options\.composition/u);
assert.match(operation, /negativePromptAdditions: options\.composition/u);
assert.match(generator, /input\.suppressCreatorDetails \? "" : input\.account\.displayName/u);
assert.match(generator, /input\.suppressStageAppearance/u);

console.log("slurp2 artwork prompt options regression passed");
