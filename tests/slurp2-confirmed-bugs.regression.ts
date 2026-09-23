import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = join(import.meta.dirname, "..");
const source = (path: string) => readFileSync(join(root, path), "utf8");
const slp = "packages/slurp2/src/engine/packages";

const refreshStorage = source(`${slp}/server/src/slp/data/creators/slp-creators-storage-2.ts`);
assert.match(refreshStorage, /reconcileSlpRefreshSchedule\(current, settings\.refreshesPerDay, at\)/u);

const messageScheduler = source(`${slp}/server/src/slp/features/messages/slp-message-scheduler-service.ts`);
assert.doesNotMatch(messageScheduler, /thread\.coolUntil/u);
assert.match(messageScheduler, /replyObligationCreatedAt: bubble\.createdAt/u);
const coolOff = source(`${slp}/server/src/slp/data/messages/slp-messages-storage-actions.ts`);
const coolOffBlock = coolOff.match(/async beginCoolOff[\s\S]*?\n    \},/u)?.[0] ?? "";
assert.ok(coolOffBlock);
assert.doesNotMatch(coolOffBlock, /removeForThread/u);

const responseFormat = source(`${slp}/server/src/slp/base/prompting/slp-response-format.ts`);
assert.match(responseFormat, /imagePrompt: nullableString/u);
assert.match(responseFormat, /parentInteractionId: nullableString/u);
assert.match(
  responseFormat,
  /required: \["actorHandle", "creatorAccountId", "targetPostId", "type", "content", "parentInteractionId"\]/u,
);

const taskRoutes = source(`${slp}/server/src/slp/features/maintenance/slp-maintenance-routes.ts`);
assert.match(taskRoutes, /\["queued", "running"\]\.includes\(row\.status\)/u);
assert.match(taskRoutes, /audience\.lastRun\.error \?\?/u);

const dayPlan = source(`${slp}/server/src/slp/modules/audience/slp-fan-activity-day-plan.ts`);
assert.match(dayPlan, /error\?: string \| null/u);
assert.match(dayPlan, /row\.error === undefined \|\| row\.error === null \|\| typeof row\.error === "string"/u);
assert.match(dayPlan, /error !== undefined \? \{ error \} : \{\}/u);

const arcEditor = source(`${slp}/client/src/slp/features/projects/SlpArcLibraryDraftEditor.tsx`);
assert.match(arcEditor, /return \{\s*\.\.\.chapter,\s*label: chapter\.label\.trim\(\)/u);

const storyPacks = source(`${slp}/server/src/slp/modules/world/events/slp-story-packs.ts`);
assert.match(storyPacks, /hasCorePlaceholderHash/);
assert.match(storyPacks, /contentFingerprint\(installed\) === incomingHash/);

const threadRoutes = source(`${slp}/server/src/slp/features/messages/slp-messages-thread-routes.ts`);
assert.match(threadRoutes, /search: z\.string\(\)\.trim\(\)\.max\(200\)\.optional\(\)/u);
assert.match(threadRoutes, /parsed\.data\.search/u);

const messageStorage = source(`${slp}/server/src/slp/data/messages/slp-messages-storage-base.ts`);
assert.match(messageStorage, /const needle = search\?\.trim\(\)\.toLocaleLowerCase\(\)/u);
assert.match(messageStorage, /\.limit\(needle \? 10_000 : bounded \+ 1\)/u);

const followUpStorage = source(`${slp}/server/src/slp/data/messages/slp-messages-storage-follow-ups.ts`);
assert.match(followUpStorage, /followUps\.slice\(0, Math\.max\(0, 3 - pendingCount\)\)/u);

const scheduler = source(`${slp}/server/src/slp/features/messages/slp-message-scheduler-service.ts`);
assert.doesNotMatch(scheduler, /failed = true;\s*logger\.warn\(error, "\[slurp-message\] Failed to deliver bubble/u);

const messagesUi = source(`${slp}/client/src/slp/features/messages/SlpMessages.tsx`);
assert.match(messagesUi, /ui\.slurp\.messages\.newChatFailed/u);

console.log("slurp2 confirmed bugs regression passed");
