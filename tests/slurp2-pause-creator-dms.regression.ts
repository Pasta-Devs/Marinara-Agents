import assert from "node:assert/strict";
import {
  SLURP_ENGINE_ROLEPLAY_MS,
  markSlurpEngineRoleplay,
  slurpInEngineRoleplay,
} from "../packages/slurp2/src/engine/packages/server/src/slp/data/messages/slp-engine-roleplay-storage.js";
import { slurp2Source } from "./slurp2-source";

// No Creator writes first while the player roleplays with them in an Engine chat (automatic), or while
// Settings › Messaging "Pause Creator DMs" is on (manual). Unasked texts are dropped (no backlog when
// the pause ends); owed follow-ups wait. The carryover into Engine chats leaves out unasked texts the
// player has not answered. The busy window is run for real; the wiring is checked in source, like the
// "Stop after one unanswered text" regression, because the scheduler and storage need a real Engine.

const PACKAGES = "packages/slurp2/src/engine/packages";

function main() {
  // The busy window: starts with an Engine reply, ends by itself.
  const t0 = 1_000_000;
  assert.equal(slurpInEngineRoleplay("creator-a", t0), false, "no Engine reply yet: not busy");
  markSlurpEngineRoleplay("creator-a", t0);
  assert.equal(slurpInEngineRoleplay("creator-a", t0 + 60_000), true, "busy right after an Engine reply");
  assert.equal(slurpInEngineRoleplay("creator-b", t0 + 60_000), false, "only the Creator in that chat is busy");
  assert.equal(slurpInEngineRoleplay("creator-a", t0 + SLURP_ENGINE_ROLEPLAY_MS), false, "the window ends by itself");

  const settings = slurp2Source(`${PACKAGES}/server/src/slp/modules/settings/slp-settings.ts`);
  assert.match(settings, /messagesCreatorDmsPaused: z\.boolean\(\)/u, "the setting is declared");
  assert.match(settings, /messagesCreatorDmsPaused: false/u, "the setting defaults off");

  const context = slurp2Source(`${PACKAGES}/server/src/slp/features/creators/slp-chat-context.ts`);
  assert.match(
    context,
    /for \(const creator of creators\) markSlurpEngineRoleplay\(creator\.id\);/u,
    "the carryover call marks the Creators in the Engine chat as busy",
  );
  assert.match(
    context,
    /message\.createdAt > \(lastReply\?\.createdAt \?\? ""\) && isUnsolicitedCreatorMessage\(message\)\) continue;/u,
    "the carryover leaves out unasked texts after the player's last reply",
  );

  const storage = slurp2Source(`${PACKAGES}/server/src/slp/data/messages/slp-messages-storage-conversation.ts`);
  assert.match(
    storage,
    /gateSettings\?\.messagesCreatorDmsPaused \|\|\s*\(checkUnsolicitedGate && slurpInEngineRoleplay\(thread\.creatorAccountId\)\)/u,
    "every unasked send path (openers, drama questions, check-ins) is dropped at write time",
  );
  assert.match(
    storage,
    /if \(unasked && \(busy \|\| \(await slurp\.getSettings\(\)\)\.messagesCreatorDmsPaused\)\) return null;\s*const opened = await context\.storage\.openThread/u,
    "sendCreatorMessage drops an unasked text before it opens an empty chat",
  );

  const server = `${PACKAGES}/server/src/slp`;
  for (const [file, guard, opens] of [
    [
      "features/world/slp-world-operation.ts",
      "SLURP_MAX_CREATOR_OPENERS_PER_TICK || settings.messagesCreatorDmsPaused) break;",
      "planSlurpCreatorCheckIn(input)",
    ],
    ["features/world/slp-drama-service.ts", 'slurpInEngineRoleplay(job.actorId)) return "drop";', "openThread("],
    ["features/messages/slp-partner-texts-service.ts", "messagesCreatorDmsPaused) return;", "openThread("],
    [
      "features/messages/slp-partner-texts-service.ts",
      "!viewerOf.has(id) && !slurpInEngineRoleplay(id)",
      "openThread(",
    ],
  ]) {
    const source = slurp2Source(`${server}/${file}`);
    const at = source.indexOf(guard);
    assert.ok(at >= 0, `${file} checks the pause`);
    assert.ok(at < source.indexOf(opens), `${file} checks the pause before it opens a chat`);
  }

  const scheduler = slurp2Source(`${PACKAGES}/server/src/slp/features/messages/slp-follow-up-scheduler-service.ts`);
  const branch = scheduler.match(
    /if \(settings\.messagesCreatorDmsPaused \|\| slurpInEngineRoleplay\(threadRow\.creatorAccountId\)\) \{([\s\S]*?)\n\s*continue;/u,
  );
  assert.ok(branch, "the follow-up scheduler checks the pause and the Engine roleplay");
  assert.match(
    branch[1],
    /"opener" \|\| followUp\.type === "check_in" \|\| followUp\.type === "recurring"\) \{\s*await messages\.cancelScheduledFollowUp/u,
    "unasked follow-ups are cancelled, not saved for later",
  );
  assert.match(branch[1], /postponeScheduledFollowUp/u, "owed follow-ups wait until the pause ends");
  assert.ok(
    scheduler.indexOf("settings.messagesCreatorDmsPaused") < scheduler.indexOf("await generateSlurpMessageReply("),
    "the pause is checked before any model call",
  );

  const panel = slurp2Source(`${PACKAGES}/client/src/slp/features/messages/SlpMessagingPanel.tsx`);
  assert.match(panel, /settingKey="messagesCreatorDmsPaused"/u, "Settings › Messaging shows the switch");

  console.log("slurp2 pause-creator-dms regression: ok");
}

main();
