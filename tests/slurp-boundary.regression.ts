import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");

function sourceFiles(directory: string): string[] {
  return readdirSync(join(root, directory), { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.(?:ts|tsx)$/u.test(entry.name) ? [path] : [];
  });
}

const files = [
  ...sourceFiles("packages/slurp/src/engine/packages/client"),
  ...sourceFiles("packages/slurp/src/engine/packages/server"),
];

const slurpRoutes = readFileSync(
  join(root, "packages/slurp/src/engine/packages/server/src/routes/slurp.routes.ts"),
  "utf8",
);
const slurpEntry = readFileSync(
  join(root, "packages/slurp/src/engine/packages/client/src/slurp-package-entry.tsx"),
  "utf8",
);
const slurpFanActivity = readFileSync(
  join(root, "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-fan-activity.service.ts"),
  "utf8",
);
const slurpServerEntry = readFileSync(
  join(root, "packages/slurp/src/engine/packages/server/src/services/slurp/server-entry.ts"),
  "utf8",
);
assert.match(
  slurpEntry,
  /AppDialogRenderer/u,
  "Slurp must render the dialog host used by creator and post confirmation actions",
);
assert.match(
  slurpFanActivity,
  /content = activity\.type === "reply" \? activity\.content\?\.trim\(\) \|\| null : null/u,
  "fan activity parsing must accept providers that omit null content fields",
);
assert.match(
  slurpServerEntry,
  /import \{ startNoodleRefreshScheduler \} from "\.\/slurp-refresh-scheduler\.service\.js"/u,
  "Slurp must import the automatic timeline refresh scheduler",
);
assert.match(
  slurpServerEntry,
  /startNoodleRefreshScheduler\(app, addTeardown\)/u,
  "Slurp must start the automatic timeline refresh scheduler",
);
assert.match(
  slurpServerEntry,
  /startNoodleAutoPostScheduler\(app, addTeardown\)/u,
  "Slurp must register automatic posting teardown before scheduler startup",
);
assert.match(
  slurpServerEntry,
  /startNoodlerFanActivityScheduler\(app, addTeardown\)/u,
  "Slurp must register fan activity teardown before scheduler startup",
);
assert.match(
  slurpRoutes,
  /app\.delete\("\/noodler\/posts\/:id"[\s\S]*?accountId is required[\s\S]*?existing\.authorAccountId !== accountId/u,
  "NoodleR post deletion must require and verify the owning account",
);

const slurpImages = readFileSync(
  join(root, "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-images.service.ts"),
  "utf8",
);
const slurpStorage = readFileSync(
  join(root, "packages/slurp/src/engine/packages/server/src/services/storage/slurp.storage.ts"),
  "utf8",
);
assert.match(
  slurpStorage,
  /slurp\.viewer\.\$\{personaId\}\.settings/u,
  "Slurp viewer settings must use the Engine-supported app settings table",
);
assert.doesNotMatch(
  slurpStorage,
  /slurpViewers|slurp_viewers/u,
  "Slurp must not access an Engine-unregistered viewer table",
);
const stageProfileDraft = readFileSync(
  join(root, "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-stage-profile-draft.service.ts"),
  "utf8",
);
assert.match(
  stageProfileDraft,
  /This is the same public creator[\s\S]*Use exactly[\s\S]*displayName[\s\S]*handle/u,
  "open Slurp profile creation must use the linked public identity",
);
assert.match(
  stageProfileDraft,
  /input\.request\.disclosureMode !== "open" &&[\s\S]*stageProfileContainsPublicIdentity/u,
  "open Slurp profile creation must permit its required linked identity",
);
assert.match(
  stageProfileDraft,
  /bio: input\.request\.currentDraft\?\.bio \?\? parsedDraft\.bio/u,
  "open Slurp profile creation must use the generated summary unless the user edited the bio",
);
assert.doesNotMatch(
  stageProfileDraft,
  /bio: input\.request\.currentDraft\?\.bio \?\? publicAccount\.bio/u,
  "open Slurp profile creation must not copy the complete source description into the profile bio",
);
assert.match(
  stageProfileDraft,
  /Create the same person behind a different stage name and handle[\s\S]*species[\s\S]*unusual anatomy/u,
  "hinted Slurp profile creation must preserve recognizable physical traits without the public identity",
);
assert.match(
  stageProfileDraft,
  /Create a careful hidden identity[\s\S]*Preserve only broad temperament[\s\S]*Do not reveal or preserve the face/u,
  "secret Slurp profile creation must preserve broad traits without identifying appearance",
);
assert.match(
  stageProfileDraft,
  /function noodlerSecretSourceText[\s\S]*reviewedNoodlerTemperamentThemes/u,
  "secret Slurp profile prompts must use reviewed temperament themes",
);
assert.doesNotMatch(
  stageProfileDraft.slice(
    stageProfileDraft.indexOf("function noodlerSecretSourceText"),
    stageProfileDraft.indexOf("export function noodlerSourceText"),
  ),
  /reviewedNoodlerPhysicalFacts/u,
  "secret Slurp profile prompts must not include identifying physical facts",
);
assert.match(
  slurpImages,
  /sourceAppearance[\s\S]*imageGenerationIncludeDescriptions[\s\S]*reviewedNoodlerPhysicalFacts\(sourceAppearance\)/u,
  "hidden Slurp image prompts must use reviewed physical tokens",
);
assert.match(
  slurpImages,
  /const finalPromptBase = redactIdentity\([\s\S]*rewrittenPrompt/u,
  "rewritten Slurp image prompts must receive final identity redaction",
);
assert.match(
  slurpImages,
  /imagePromptInstructions \|\| characterContext \|\| styleGuidance/u,
  "Slurp image prompts must interpret character context without connection instructions",
);
assert.match(slurpImages, /enableImageInterpretation !== false/u);
const slurpPublicImages = readFileSync(
  join(root, "packages/slurp/src/engine/packages/server/src/services/slurp/slurp-public-images.service.ts"),
  "utf8",
);
assert.match(
  slurpPublicImages,
  /imagePromptInstructions \|\| characterContext \|\| styleGuidance/u,
  "public Slurp image prompts must interpret character context without connection instructions",
);
assert.match(slurpPublicImages, /enableImageInterpretation !== false/u);
assert.match(
  slurpImages,
  /input\.disclosureMode !== "secret"[\s\S]*referenceImages/u,
  "secret Slurp identities must not receive avatar reference images",
);

const noodleHome = readFileSync(
  join(root, "packages/noodle/src/engine/packages/client/src/components/noodle/NoodleHome.tsx"),
  "utf8",
);
assert.match(
  noodleHome,
  /settingsContent[\s\S]*pb-\[calc\(56px\+var\(--noodle-safe-bottom\)\)\]/u,
  "Noodle settings must reserve space for the mobile bottom navigation",
);

const noodleShell = readFileSync(
  join(root, "packages/noodle/src/engine/packages/client/src/components/noodle/NoodleShell.tsx"),
  "utf8",
);
assert.match(
  noodleShell,
  /BOTTOM_SAFE_INSET =[\s\S]*-webkit-touch-callout[\s\S]*env\(safe-area-inset-bottom\)[\s\S]*"0px"/u,
  "the bottom safe-area inset must stay WebKit-only, or Android gains an empty strip under the nav",
);

for (const file of files) {
  const source = readFileSync(join(root, file), "utf8");
  for (const marker of [
    /packages\/noodle\/src\/engine\/packages/u,
    /\/api\/noodle/u,
    /noodle\.settings/u,
    /["`]noodle_(?:accounts|posts|interactions|prepared_posts|automatic_attempts|reserve_state|fan_activity_state|account_subscriptions|post_unlocks)["`]/u,
    /["`]noodler_(?:accounts|posts|interactions|prepared_posts|automatic_attempts|reserve_state|fan_activity_state|account_subscriptions|post_unlocks)["`]/u,
  ]) {
    assert.doesNotMatch(source, marker, `${file} contains a legacy Noodle persistence marker: ${marker}`);
  }
}

console.log("Slurp extraction boundary regressions passed.");
