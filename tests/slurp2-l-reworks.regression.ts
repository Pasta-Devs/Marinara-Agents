import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SLURP_ADULT_LEVELS,
  SLURP_CREATOR_STATE_DEFAULT,
  SLURP_THREAD_POSTURES,
  SLURP_THREAD_STATE_DEFAULT,
  nextSlurpAdultLevel,
  slurpAdultRiseBlock,
  slurpCreatorStateCanUseMedia,
  slurpCreatorStateMediaBlock,
  type SlurpCreatorState,
  type SlurpThreadState,
} from "../packages/slurp2/src/engine/packages/server/src/slp/modules/creators/slp-creator-state.ts";
import { slurpDmPictureVerdict } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/world/slp-stance.ts";
import {
  estimateSlurpSimulation,
  slurpEstimateModelRuns,
  SLURP_ESTIMATE_SAMPLE,
} from "../packages/slurp2/src/engine/packages/client/src/slp/modules/audience/slp-simulation-estimate.ts";
import { slurpTuningForPreset } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-tuning.ts";
import { SLURP_BUILTIN_FAN_TYPES } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-fan-types.ts";
import { slpWithSetPictureChange } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-post-images.ts";
import { slpCreatorPostUpdateSchema } from "../packages/slurp2/src/engine/packages/shared/src/slp/slp-social.schema.ts";
import { slurp2Source } from "./slurp2-source.ts";

// L (larger reworks from review 1).
const pkg = join(import.meta.dirname, "..", "packages/slurp2/src/engine/packages");
const read = (path: string) => slurp2Source(join(pkg, path));

// ── R1-012: the Details verdicts are the server's own rules ──
{
  // The rise blocker agrees with the rule it explains, over a grid of states.
  const values = [0, 19, 20, 35, 36, 39, 40, 41, 45, 60, 80, 100];
  let checked = 0;
  for (const adultLevel of SLURP_ADULT_LEVELS)
    for (const posture of SLURP_THREAD_POSTURES)
      for (const sexualComfort of values)
        for (const threadDesire of values)
          for (const respect of [30, 40])
            for (const resentment of [40, 41]) {
              const state = {
                ...SLURP_THREAD_STATE_DEFAULT,
                adultLevel,
                posture,
                sexualComfort,
                threadDesire,
                respect,
                resentment,
                updatedAt: "",
              } as SlurpThreadState;
              const block = slurpAdultRiseBlock(state);
              const from = SLURP_ADULT_LEVELS.indexOf(adultLevel);
              const to = SLURP_ADULT_LEVELS.indexOf(nextSlurpAdultLevel(state));
              if (block === null) assert.equal(to, from + 1, `${JSON.stringify(state)} should rise`);
              else if (block === "falling") assert.equal(to, from - 1, `${JSON.stringify(state)} should fall`);
              else assert.equal(to, from, `${JSON.stringify(state)} held by ${block}`);
              checked += 1;
            }
  assert.ok(checked > 1000);
  const base = { ...SLURP_THREAD_STATE_DEFAULT, updatedAt: "" } as SlurpThreadState;
  assert.equal(slurpAdultRiseBlock({ ...base, respect: 30, sexualComfort: 50 }), "respect");
  assert.equal(
    slurpAdultRiseBlock({ ...base, adultLevel: "explicit", sexualComfort: 90, threadDesire: 90, respect: 90 }),
    "top",
  );

  // The picture state block is the same gate the reply uses.
  for (const energy of [10, 25, 60])
    for (const arousal of [0, 36])
      for (const posture of SLURP_THREAD_POSTURES)
        for (const sexualComfort of [30, 36])
          for (const respect of [30, 36]) {
            const creator = { ...SLURP_CREATOR_STATE_DEFAULT, energy, arousal, updatedAt: "" } as SlurpCreatorState;
            const thread = { ...base, posture, sexualComfort, respect } as SlurpThreadState;
            assert.equal(
              slurpCreatorStateMediaBlock(creator, thread) === null,
              slurpCreatorStateCanUseMedia(creator, thread),
            );
          }

  // The verdict follows the reply's order and never reports a mode it would not send.
  const warm = { latitude: "normal" as const, canSendImage: true, imageMode: "friendly" as const };
  const verdict = (over: Partial<Parameters<typeof slurpDmPictureVerdict>[0]>) =>
    slurpDmPictureVerdict({ stance: warm, support: false, imagesEnabled: true, stateBlock: null, ...over });
  assert.deepEqual(verdict({}), { mode: "friendly", blockedBy: null });
  assert.deepEqual(verdict({ support: true, imagesEnabled: false }), { mode: "none", blockedBy: "support" });
  assert.deepEqual(verdict({ imagesEnabled: false }), { mode: "none", blockedBy: "images_off" });
  assert.deepEqual(verdict({ stance: { ...warm, canSendImage: false, imageMode: "none" } }), {
    mode: "none",
    blockedBy: "stance",
  });
  assert.deepEqual(verdict({ stance: { ...warm, latitude: "cool_off" } }), { mode: "none", blockedBy: "cooling_off" });
  assert.deepEqual(verdict({ stateBlock: "energy" }), { mode: "none", blockedBy: "energy" });
  assert.deepEqual(verdict({ stance: { ...warm, imageMode: "hostile" } }), { mode: "hostile", blockedBy: null });

  // Wiring: the route sends them, the client stops re-deriving.
  const threadRoutes = read("server/src/slp/features/messages/slp-messages-thread-routes.ts");
  assert.match(threadRoutes, /resolveSlurpThreadStance\(app\.db/u);
  assert.match(threadRoutes, /pictures: slurpDmPictureVerdict\(/u);
  assert.match(threadRoutes, /escalation: \{ blockedBy: slurpAdultRiseBlock\(thread\.threadState\) \}/u);
  assert.doesNotMatch(threadRoutes, /thread\.mood <= -40/u);
  const insights = read("client/src/slp/features/messages/SlpMessageInsights.tsx");
  assert.doesNotMatch(insights, /threadState\.posture === "rejecting" \|\| threadState\.posture === "defensive"/u);
  assert.doesNotMatch(insights, /\? "She is not comfortable enough with this fan yet\."/u);
  assert.match(insights, /relationship\.escalation\?\.blockedBy/u);
  assert.match(insights, /relationship\.pictures \?\?/u);
  // The prompt builder reads the same stance helper.
  assert.match(
    read("server/src/slp/features/messages/slp-message-generation-service.ts"),
    /const stance = await resolveSlurpThreadStance\(input\.db/u,
  );
}

// ── R1-011: Prompt details builds from the reply's inputs ──
{
  const promptRoute = read("server/src/slp/features/messages/slp-messages-creator-routes.ts");
  const operation = read("server/src/slp/features/messages/slp-message-operation.ts");
  for (const source of [promptRoute, operation]) {
    assert.match(source, /resolveSlurpReplyViewer\(/u);
    assert.match(source, /resolveSlurpReplyAvailability\(/u);
  }
  assert.match(promptRoute, /settings\.modelBudget\.connectionId \?\? settings\.generationConnectionId/u);
  assert.match(promptRoute, /threadId: thread\.id,/u);
  assert.match(promptRoute, /strikes: activeSlurpStrikes\(thread\.strikes, thread\.lastStrikeAt\)/u);
  assert.match(promptRoute, /details\.dayVibe !== undefined \? details\.dayVibe/u);
  assert.doesNotMatch(promptRoute, /const fan = await slurp\.getViewer/u);
}

// ── R1-034: a kept promise is recorded at publish, not when the slot is prepared ──
{
  const reserveOperation = read("server/src/slp/features/feed/reserve/slp-reserve-operation.ts");
  assert.doesNotMatch(reserveOperation, /recordSlurpPromiseKept/u);
  const reserveStorage = read("server/src/slp/data/feed/reserve/slp-reserve-storage-2.ts");
  const publish = reserveStorage.slice(
    reserveStorage.indexOf("async publishDueNoodlerPreparedPosts"),
    reserveStorage.indexOf("async reconcileNoodlerPreparedPosts"),
  );
  const kept = publish.indexOf("recordSlurpPromiseKept(db, opportunity, { postId: didPublish, at })");
  assert.ok(kept > 0, "the publish loop records the kept promise with the published post");
  assert.ok(kept > publish.indexOf("if (!didPublish) continue;"), "only after the post went up");
  assert.match(publish, /findSlurpOpportunityBySlot\(db, item\.id\)/u);
  // One home for the record, in the data layer both paths can reach.
  assert.match(
    read("server/src/slp/data/feed/slp-opportunity-storage.ts"),
    /export async function recordSlurpPromiseKept\(/u,
  );
  assert.doesNotMatch(
    readFileSync(join(pkg, "server/src/slp/features/feed/slp-post-plan-service.ts"), "utf8"),
    /export async function recordSlurpPromiseKept/u,
  );
}

// ── R1-116: the audience estimate models Fan Types, tips, unlocks, AI runs and the world dial ──
{
  const tuning = slurpTuningForPreset("realistic");
  const run = (world: Parameters<typeof estimateSlurpSimulation>[3]) =>
    estimateSlurpSimulation(tuning, SLURP_ESTIMATE_SAMPLE, undefined, world);
  const base = run({});
  // The world dial: off silences the free world, busy is louder than normal.
  const off = run({ worldActivity: "off" });
  for (const key of ["likes", "follows", "comments", "commissions", "questions", "tips", "unlocks", "income"] as const)
    assert.equal(off[key], 0, `off: ${key}`);
  assert.ok(run({ worldActivity: "busy" }).follows > base.follows, "busy follows more");
  assert.ok(run({ worldActivity: "quiet" }).follows < base.follows, "quiet follows less");
  // Tips and unlocks are counted and paid into income; Fan Types decide them.
  assert.ok(base.tips + base.unlocks > 0, "the sample week tips or unlocks something");
  const stingy = run({
    fanTypes: SLURP_BUILTIN_FAN_TYPES.map((type) => ({
      ...type,
      spend: { ...type.spend, tipChance: 0 },
      behavior: { ...type.behavior, unlock: 0 },
    })),
  });
  assert.equal(stingy.tips, 0);
  assert.equal(stingy.unlocks, 0);
  assert.ok(stingy.income < base.income, "no tips or unlocks, less income");
  // Background profiles join only when switched on, and they change the week.
  assert.notDeepEqual(run({ allowRandomUsers: true }), base);
  // AI-written runs: the setting capped by the budget row, each at its ceiling.
  const budget = { jobs: { thread: { maxPerDay: 3 } } };
  assert.equal(slurpEstimateModelRuns({ fanActivityEnabled: false, fanActivityRunsPerDay: 8, modelBudget: budget }), 0);
  assert.equal(slurpEstimateModelRuns({ fanActivityEnabled: true, fanActivityRunsPerDay: 8, modelBudget: budget }), 3);
  assert.equal(slurpEstimateModelRuns({ fanActivityEnabled: true, fanActivityRunsPerDay: 2, modelBudget: budget }), 2);
  const withRuns = run({
    fanActivityEnabled: true,
    fanActivityRunsPerDay: 8,
    modelBudget: budget,
    fanLikesPerRefresh: 2,
    fanRepliesPerRefresh: 6,
  });
  assert.equal(Math.round((withRuns.likes - base.likes) * 100) / 100, 6);
  assert.equal(Math.round((withRuns.comments - base.comments) * 100) / 100, 18);
  // The server rule the estimate mirrors is still the setting capped by the thread row.
  assert.match(
    read("server/src/slp/features/audience/slp-fan-activity-operation.ts"),
    /return Math\.min\(boosted, settings\.modelBudget\.jobs\.thread\.maxPerDay\);/u,
  );
  // Both screens hand the estimate the settings, not the tuning alone.
  // Merge L × F: the settings with the AI budget sized for today's Creators (changed on purpose).
  assert.match(
    read("client/src/slp/features/audience/SlpAudiencePanel.tsx"),
    /world=\{\{ \.\.\.settings, modelBudget: effectiveBudget \}\}/u,
  );
  assert.match(
    read("client/src/slp/features/backstage/SlpBackstagePreview.tsx"),
    /estimateSlurpSimulation\(deferredProposed\.simulationTuning, undefined, undefined, deferredProposed\)/u,
  );
}

// ── R1-120 (part): the Calendar panel and the event activation options go through locales ──
{
  const en = JSON.parse(read("client/src/slp/locales/en.json")) as Record<string, string>;
  const calendar = read("client/src/slp/features/world/SlpCalendarPanel.tsx");
  const events = read("client/src/slp/features/world/SlpPlatformEventsPanel.tsx");
  for (const source of [calendar, events])
    for (const [, key] of source.matchAll(/\bt\(\s*"([^"]+)"/gu)) assert.ok(key in en, `missing English key ${key}`);
  // The dynamic ones: every kind and status the calendar can show.
  for (const kind of ["occasion", "plan", "occurrence"]) assert.ok(`ui.slurp.calendar.kind.${kind}` in en, kind);
  for (const status of ["scheduled", "suggested", "active", "paused", "completed", "dismissed", "cancelled"])
    assert.ok(`ui.slurp.calendar.status.${status}` in en, status);
  // Plurals for the day counts.
  for (const key of ["whenAnnual", "whenManual"]) assert.ok(`ui.slurp.settings.events.${key}_one` in en, key);
  // No English left in the markup of either panel.
  for (const literal of [
    ">Today<",
    "Your Slurp calendar",
    "Loading calendar",
    '"Running event"',
    "Create storyline from event",
    "Open Packs</span>",
  ])
    assert.ok(!calendar.includes(literal), `calendar still says ${literal}`);
  for (const literal of [
    ">Annual date<",
    ">Manual campaign<",
    ">Existing advanced trigger<",
    ">Manual only<",
    ">All current Creators<",
    "`Manual · ",
    "reaches ${",
  ])
    assert.ok(!events.includes(literal), `events still say ${literal}`);
}

// ── R1-019 (part): typing after a photo ──
{
  const media = read("server/src/slp/features/messages/slp-messages-media-routes.ts");
  assert.equal(
    media.match(/\.\.\.\(await replyToPhoto\(threadId, /gu)?.length,
    2,
    "both photo routes answer like a text",
  );
  const helper = media.slice(media.indexOf("const replyToPhoto"), media.indexOf("app.post("));
  assert.match(helper, /typingMs: "pacing" in outcome \? outcome\.pacing\.typingMs : 0/u);
  assert.match(helper, /reply: outcome\.status === "replied" \? maskForViewer\(outcome\.message\) : null/u);
  assert.match(helper, /catch \(error\) \{[\s\S]*status: "failed"/u, "a failed reply is a status, not a thrown error");
  const tools = read("client/src/slp/features/messages/SlpMessageTools.tsx");
  assert.match(tools, /onSent\?\.\(result\);/u);
  const composer = read("client/src/slp/features/messages/SlpThreadComposer.tsx");
  assert.equal(composer.match(/onSent=\{answerPhoto\}/gu)?.length, 2, "upload and draw both answer");
  const answer = composer.slice(composer.indexOf("const answerPhoto"), composer.indexOf("const toolRow"));
  assert.match(answer, /holdTyping\(result\.reply \? \(result\.typingMs \?\? 0\) : 0, result\.reply\?\.id\)/u);
  assert.match(answer, /setReplyStatus\(result\.replyStatus\)/u);
  assert.match(answer, /closeTools\(\)/u);
}

// ── R1-039 (part): Replace and Crop act on the chosen picture of a set ──
{
  const crop = { x: 0.1, y: 0.2, width: 0.5, height: 0.5, sourceWidth: 1024, sourceHeight: 1536 };
  const set = [
    { id: "a", position: 1, imageUrl: "/m/1", imagePrompt: "one", crop: { x: 0, y: 0, width: 1, height: 1 } },
    { id: "b", position: 2, imageUrl: "/m/2", imagePrompt: "two" },
  ];
  const cropped = slpWithSetPictureChange(set, 2, { replaced: false, crop }) as typeof set;
  assert.deepEqual(cropped[1], { ...set[1], crop }, "the chosen picture takes the crop");
  assert.deepEqual(cropped[0], set[0], "the other picture is untouched");
  const replaced = slpWithSetPictureChange(set, 1, { replaced: true, crop: undefined }) as Record<string, unknown>[];
  assert.equal(replaced[0]!.imagePrompt, null, "a replacement drops the old prompt");
  assert.equal("crop" in replaced[0]!, false, "and the old crop");
  assert.equal(replaced[0]!.imageUrl, "/m/1", "the URL stays the position's");
  const replacedCropped = slpWithSetPictureChange(set, 1, { replaced: true, crop }) as Record<string, unknown>[];
  assert.deepEqual(replacedCropped[0]!.crop, crop, "a replacement keeps the crop chosen with it");
  // Merge L × V: a new file never keeps the old picture's size (the frame ratio), and takes its own.
  const sized = [{ ...set[0]!, width: 800, height: 1000 }];
  const resized = slpWithSetPictureChange(sized, 1, { replaced: true, crop: undefined }) as Record<string, unknown>[];
  assert.equal("width" in resized[0]! || "height" in resized[0]!, false, "the old size goes with the old file");
  const newSize = slpWithSetPictureChange(sized, 1, {
    replaced: true,
    crop: undefined,
    size: { width: 1200, height: 628 },
  }) as Record<string, unknown>[];
  assert.deepEqual([newSize[0]!.width, newSize[0]!.height], [1200, 628], "the new file's size");
  assert.equal(
    (slpWithSetPictureChange(sized, 1, { replaced: false, crop }) as Record<string, unknown>[])[0]!.width,
    800,
    "a crop keeps the size",
  );
  const cleared = slpWithSetPictureChange(set, 1, { replaced: false, crop: null }) as Record<string, unknown>[];
  assert.equal("crop" in cleared[0]!, false);
  assert.equal(slpWithSetPictureChange(set, 3, { replaced: false, crop }), null, "no picture there");
  assert.equal(slpWithSetPictureChange(undefined, 1, { replaced: false, crop }), null);
  assert.ok(slpCreatorPostUpdateSchema.safeParse({ imageCrop: crop, imagePosition: 2 }).success);
  assert.ok(!slpCreatorPostUpdateSchema.safeParse({ imagePosition: -1, imageCrop: crop }).success);

  const storage = read("server/src/slp/data/feed/slp-feed-post-storage-2.ts");
  assert.match(storage, /const imageChanged = setPosition === null && Boolean\(media \|\| input\.removeImage\)/u);
  assert.match(storage, /eq\(slpPostMedia\.position, setPosition\)/u);
  const operation = read("server/src/slp/features/feed/slp-post-operation.ts");
  assert.match(operation, /const oldPath = position > 0 \? await setFile\(\) : readCreatorMediaPath\(current\)/u);
  assert.match(
    read("server/src/slp/data/host/slp-storage-mappers.ts"),
    /crop: readSlpPostImageCrop\(\{ imageCrop: media\.crop \}\)/u,
  );
  const actions = read("client/src/slp/app/slp-home-post-actions.ts");
  assert.equal(
    actions.match(/imagePosition: input\.image\.position/gu)?.length,
    2,
    "replace and crop send the position",
  );
  const hooks = read("client/src/slp/modules/post/SlpPostHooks.tsx");
  assert.match(hooks, /\{ kind: "replace", file: cropSource\.source, crop, position \}/u);
  assert.match(hooks, /loadPostImage\(picture \? \{ \.\.\.post, imageUrl: picture\.imageUrl \} : post\)/u);
  const controls = read("client/src/slp/modules/post/SlpPostImageEditControls.tsx");
  assert.match(controls, /<SlpPostImageNav/u);
  assert.match(controls, /editing\.choosePosition\(pictures\[next\]!\.position\)/u);
  assert.match(read("client/src/slp/modules/post/SlpPostCard.tsx"), /crop=\{activeCrop\}/u);
}

console.log("slurp2-l-reworks: ok");
