import assert from "node:assert/strict";

import { slurp2Source } from "./slurp2-source";

const root = "packages/slurp2/src/engine/packages/";
const editor = slurp2Source(`${root}client/src/slp/features/creators/SlpCreatorProfileEditor.tsx`);
const hook = slurp2Source(`${root}client/src/slp/features/creators/slp-creator-profile-hooks.ts`);
const route = slurp2Source(`${root}server/src/slp/features/media/slp-media-routes.ts`);
const operation = slurp2Source(`${root}server/src/slp/features/creators/slp-artwork-operation.ts`);
const generator = slurp2Source(`${root}server/src/slp/features/media/slp-images-service.ts`);

// 3c: the Creator settings artwork tool folds into the shared picture assist, which keeps the four
// switches under Advanced and sends them with the draw-picture action.
const assist = slurp2Source(`${root}client/src/slp/features/assist/SlpPictureAssist.tsx`);
const actions = slurp2Source(`${root}shared/src/slp/slp-actions.ts`);
const draw = slurp2Source(`${root}server/src/slp/features/assist/slp-assist-service.ts`);
for (const option of ["creatorDetails", "appearance", "sourceReferences", "composition"]) {
  assert.match(assist, new RegExp(`\\["${option}", "ui\\.slurp\\.artwork\\.option`), `${option} is selectable`);
  assert.match(actions, new RegExp(`${option}: z\\.boolean\\(\\)`), `${option} is validated on the server`);
  assert.match(route, new RegExp(`${option}: z\\.boolean\\(\\)`), `${option} is validated on the old route`);
}
assert.match(editor, /<SlpPictureAssist[\s\S]*?advanced/u);
assert.match(assist, /type="checkbox"[\s\S]*checked=\{options\[key\]\}/u);
assert.match(assist, /\.\.\.\(advanced \? \{ options \} : \{\}\)/u);
assert.match(draw, /suppressCreatorDetails: !options\.creatorDetails/u);
assert.match(draw, /suppressStageAppearance: !options\.appearance/u);
assert.match(draw, /suppressCharacterContext: !options\.sourceReferences/u);
assert.match(draw, /slot && options\.composition[\s\S]*?compositionGuard: artworkCompositionGuard\(slot\)/u);
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
