import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveSlurpTextConnection } from "../packages/slurp2/src/engine/packages/server/src/slp/base/identity/slp-connection";
import { splitSlurpReplyBurst } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-messaging";
import { slurpModelBudgetSchema } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-model-budget";
import { slurp2Source } from "./slurp2-source.ts";

// Fix phase 1, batch E (REVIEW-1 settings that lied or did nothing): R1-003, R1-004, R1-009, R1-095,
// R1-097, R1-104, R1-105, R1-107, R1-108, R1-109, R1-123, R1-124, R1-126, R1-127, R1-128, R1-129, R1-130.
const pkg = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages");
const read = (path: string) => readFileSync(join(pkg, path), "utf8");
const en = JSON.parse(read("client/src/slp/locales/en.json")) as Record<string, string>;

async function main() {
  // ── R1-003: the split aims at the player's limit (4 sentences, limit 4 → 4 bubbles) ──
  const four =
    "I just got back from the shoot. It went so well today. The light was perfect all day. Tell me about yours?";
  assert.equal(splitSlurpReplyBurst(four, true, 4).length, 4);
  assert.equal(splitSlurpReplyBurst(four, true, 3).length, 3);
  assert.equal(splitSlurpReplyBurst(four, true, 2).length, 2);
  assert.equal(splitSlurpReplyBurst(four, true, 1).length, 1);
  // Tiny sentences are not sent one per bubble: each bubble stays worth sending.
  const tiny = "Yes. Ok. Sure. Fine. Right. Cool. Nice one. Haha. Love it. Same. Wow. Omg. Yep.";
  assert.ok(splitSlurpReplyBurst(tiny, true, 4).every((bubble) => bubble.length >= 8));
  assert.deepEqual(splitSlurpReplyBurst("A short reply.", true, 4), ["A short reply."]);
  assert.match(en["ui.slurp.settings.messaging.bubbleLimitDetail"] ?? "", /can use fewer/u);
  assert.doesNotMatch(en["ui.slurp.settings.messaging.bubbleLimitDetail"] ?? "", /a short one can be split/u);

  // ── R1-004: 0 minutes means right away ──
  assert.match(
    slurp2Source(join(pkg, "server/src/slp/features/messages/slp-message-operation.ts")),
    /settingsForDelays\.messagesMaxReplyDelayMinutes <= 0\s*\?\s*0/u,
  );

  // ── R1-128: a deleted chosen connection falls back to the default ──
  const language = { id: "language", provider: "openai" };
  const stub = {
    getWithKey: async (id: string) => (id === "language" ? language : null),
    getDefaultForAgents: async () => language,
    getDefault: async () => language,
  } as never;
  assert.equal((await resolveSlurpTextConnection(stub, "deleted-connection"))?.id, "language");
  assert.equal((await resolveSlurpTextConnection(stub, "language"))?.id, "language");

  // ── R1-104: the default thread budget covers the default runs; the cap is said out loud ──
  assert.equal(slurpModelBudgetSchema.parse({}).jobs.thread.maxPerDay, 8);
  assert.match(
    read("client/src/slp/features/audience/SlpAudiencePanel.tsx"),
    /ui\.slurp\.settings\.audience\.runsPerDayCapped/u,
  );
  assert.ok(en["ui.slurp.settings.audience.runsPerDayCapped"]);

  // ── R1-105: written audience replies follow the AI budget ──
  const audienceReply = read("server/src/slp/features/audience/slp-audience-reply-operation.ts");
  assert.match(audienceReply, /if \(!slurpModelWorkerAllows\(settings\.modelBudget, "present"\)\) return 0;/u);
  assert.match(audienceReply, /claimSlurpModelBudget\(db, settings\.modelBudget, "thread"\)/u);
  assert.match(audienceReply, /settings\.modelBudget\.connectionId \?\? settings\.generationConnectionId/u);

  // ── R1-107, changed in 0.3.6: the schedule refresh is the player's tap and never spends the budget ──
  const creatorsRoutes = read("server/src/slp/features/creators/slp-creators-routes.ts");
  assert.doesNotMatch(creatorsRoutes, /claimSlurpModelBudget|slurpModelWorkerAllows/u);

  // ── R1-108: a refused or failed generated arc falls back to a library storyline ──
  const projects2 = read("server/src/slp/data/projects/slp-projects-storage-2.ts");
  assert.match(projects2, /\(\{ pick, projects \} = await roll\("library"\)\);/u);

  // ── R1-109: storylines move on with the world dial Off; the copy says what Off does ──
  const world = read("server/src/slp/features/world/slp-world-operation.ts");
  assert.match(
    world,
    /if \(activity === 0\) \{[\s\S]{0,400}noodle\.tickProjects\(account\.id, until\)[\s\S]{0,300}rollAutoArc/u,
  );
  assert.doesNotMatch(en["ui.slurp.settings.audience.activityDetail"] ?? "", /nobody interrupts you at all/u);

  // ── R1-123 / R1-124: new Creators get the images default; Stories unlock when a Creator draws ──
  assert.match(
    read("server/src/slp/data/creators/slp-creators-storage-3.ts"),
    /imagesEnabled: \(await this\.getSettings\(\)\)\.autoPostingImagesEnabled === true,/u,
  );
  const publishing = read("client/src/slp/features/feed/SlpPublishingPanel.tsx");
  assert.match(publishing, /creatorList\.some\(\(creator\) => creator\.autoPosting\.imagesEnabled\)/u);
  assert.doesNotMatch(publishing, /!settings\.autoPostingImagesEnabled/u);

  // ── R1-126 / R1-127: the preview takes the post call's picture path; the empty text is honest ──
  const preview = read("server/src/slp/features/feed/slp-prompt-preview-service.ts");
  assert.doesNotMatch(preview, /allowImagePrompt: settings\.enableImagePrompts/u);
  assert.match(preview, /allowScenePlan: postImages,/u);
  assert.match(preview, /accessInstruction: await resolveSlurpPostGuidance\(db, account\.id, "public"\)/u);
  assert.doesNotMatch(en["ui.slurp.settings.prompts.previewEmpty"] ?? "", /adds nothing/u);

  // ── R1-129 / R1-130: staged pages say so; every way out of Backstage asks first ──
  const shell = read("client/src/slp/app/backstage/SlpBackstageShell.tsx");
  assert.match(
    shell,
    /section === "overview" \|\|\s*target === "basic" \|\|\s*slpTargetSwitchedOff\(target, settings\)\s*\?\s*t\("ui\.slurp\.settings\.autoSave"\)\s*:\s*t\("ui\.slurp\.settings\.stagedSave"/u,
  );
  const controls = read("client/src/slp/features/backstage/SlpBackstageControls.tsx");
  assert.match(controls, /export function useSlpBackstageLeaveGuard/u);
  assert.match(controls, /current\.mode !== "creator-settings" \|\| next\.mode === "creator-settings"/u);
  assert.match(
    read("client/src/slp/app/slp-home-state.ts"),
    /const onNavigate = useSlpBackstageLeaveGuard\(navigation, navigateRaw\);/u,
  );

  // ── R1-009 / R1-095 / R1-097: copy matches what happens ──
  assert.doesNotMatch(en["ui.slurp.messages.resetDetail"] ?? "", /what they remember of it goes/u);
  assert.match(en["ui.slurp.settings.messaging.clearHint"] ?? "", /⋮ › Clear conversation/u);
  assert.match(en["ui.slurp.settings.wallet.creatorShareDetail"] ?? "", /Collect/u);
  assert.doesNotMatch(en["ui.slurp.settings.wallet.engagementReward"] ?? "", /per post/u);
  assert.doesNotMatch(en["ui.slurp.settings.wallet.pricingDynamicCharactersDetail"] ?? "", /Current subscribers keep/u);

  console.log("slurp2 fix1 settings truth regression passed");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
