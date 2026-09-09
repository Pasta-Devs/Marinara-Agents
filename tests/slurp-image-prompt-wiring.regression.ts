import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// slurp-images.service.ts cannot be imported here: it pulls in the database and the LLM providers,
// and @marinara-engine/shared is not installed in this repository. These are source assertions on
// the wiring, which is what the defects below actually were.

const root = join(import.meta.dirname, "..");
const server = "packages/slurp/src/engine/packages/server/src";
const images = readFileSync(join(root, server, "services/slurp/slurp-images.service.ts"), "utf8");
const routes = readFileSync(join(root, server, "routes/slurp.routes.ts"), "utf8");
const rewrite = readFileSync(join(root, server, "services/slurp/slurp-image-prompt-rewrite.ts"), "utf8");

// --- the rewriter is fed the draft, not the rendered template -----------------------------------
// NOODLE_IMAGE_POST documents itself as terminal ("no LLM pass runs after it") and emits bare
// unlabelled values for that reason. Handing the rendered template to the rewriter sent the
// character context twice and asked it to preserve a personality trait list as a "visual fact".
assert.match(images, /prompt: rawRewriteInput,/u, "the rewriter receives the draft, not the template");
assert.match(
  images,
  /const rawRewriteInput = redactIdentity\(reviewedOverride\?\.prompt \|\| compiledDraft\?\.prompt \|\| draftPrompt\);/u,
);

// The template is the document that carries the appearance notes, so it is what reaches the
// provider when no rewrite survives. Falling back to the bare draft dropped appearance entirely.
assert.match(
  images,
  /const rawProviderPrompt = redactIdentity\(reviewedOverride\?\.prompt \|\| compiledPrompt\.prompt\);/u,
);
assert.match(images, /rawPrompt: rawProviderPrompt,/u);

// --- a retry is built the same way the first attempt was ----------------------------------------
// Every retry resends our own stored draft as promptOverride. The old guard read that as a
// user-reviewed prompt and skipped interpretation, style guidance, and character context, so the
// first attempt and its retry sent materially different prompts.
assert.match(images, /const skipInterpretation = Boolean\(input\.promptOverride\) && !input\.retryStoredPrompt;/u);
assert.match(images, /!skipInterpretation/u);
assert.match(images, /const reviewedOverride = input\.retryStoredPrompt \? null : compiledOverride;/u);
// The negative prompt has to follow the same rule, or a retry silently loses the profile negatives.
assert.match(images, /input\.promptOverride && !input\.retryStoredPrompt/u);

// Every path that resends a stored draft must declare itself as such.
assert.match(routes, /retryStoredPrompt: true,/u, "manual generate-image resends a stored draft");
const retryFlags = [...images.matchAll(/retryStoredPrompt: true,/gu)];
assert.equal(retryFlags.length, 1, "retryNextFailedPostImage must declare the stored prompt too");
// The flag has to actually exist on the service input, not just be passed and ignored.
assert.match(images, /retryStoredPrompt\?: boolean;/u);

// --- the interpretation model gets the same redaction the prompt beside it gets ------------------
// characterDescription is often "${name}'s Appearance: ...", built from the linked source account,
// so an unredacted context block sent the source's real name to the model in the same call whose
// prompt had that name carefully replaced.
assert.match(images, /const characterContext = redactIdentity\(/u);
assert.match(images, /instructions: redactIdentity\(imagePromptInstructions\),/u);
assert.match(images, /interpretationInstruction: input\.settings\.imagePromptInterpretation,/u);
assert.match(images, /prompt: rawRewriteInput,/u);
assert.match(
  images,
  /\(imagePromptInstructions \|\| characterContext \|\| styleGuidance\) &&\s*input\.settings\.enableImageInterpretation !== false &&\s*!skipInterpretation/u,
  "interpretation must require rewrite context, enabled interpretation, and no reviewed override",
);
assert.match(rewrite, /getDefaultForAgents\(\)\) \?\? \(await connections\.getFallbackForAgents\(\)\)/u);

// --- the anonymity guard is Secret-only ----------------------------------------------------------
assert.match(images, /input\.disclosureMode === "secret"\s*\?\s*"Compose so the face cannot be identified/u);
// Secret gets no source image references; Open and Hinted still do.
assert.match(
  images,
  /!input\.suppressCharacterContext && input\.disclosureMode !== "secret" && input\.linkedPublicAccount/u,
);
// Persona-owned Creators are eligible too. Requiring kind === "character" here meant a persona got
// appearance text and nothing else in every mode, so Open meant less for a persona than a character.
assert.doesNotMatch(
  images,
  /disclosureMode !== "secret" &&\s*input\.linkedPublicAccount\?\.kind === "character"/u,
  "persona-owned Creators must not be excluded from image context",
);
assert.match(images, /personality: sourcePersona\.personality\?\.trim\(\) \?\? "",/u);

// --- the commission path uses the same default as everything else --------------------------------
const commission = readFileSync(join(root, server, "services/slurp/slurp-commission-image.operation.ts"), "utf8");
assert.match(commission, /identityDisclosure \?\? "secret"/u);
assert.doesNotMatch(commission, /identityDisclosure \?\? "hinted"/u, "commissions must not default to a weaker tier");

console.log("slurp image prompt wiring regression passed");
