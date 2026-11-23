import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source";

// Settings › Messaging "Pause Creator DMs": while on, no Creator writes first. Unasked texts are
// dropped (no backlog when the pause ends); owed follow-ups wait. Source checks, like the
// "Stop after one unanswered text" regression, because the scheduler and storage need a real Engine.

const PACKAGES = "packages/slurp2/src/engine/packages";

function main() {
  const settings = slurp2Source(`${PACKAGES}/server/src/slp/modules/settings/slp-settings.ts`);
  assert.match(settings, /messagesCreatorDmsPaused: z\.boolean\(\)/u, "the setting is declared");
  assert.match(settings, /messagesCreatorDmsPaused: false/u, "the setting defaults off");

  const storage = slurp2Source(`${PACKAGES}/server/src/slp/data/messages/slp-messages-storage-conversation.ts`);
  assert.match(
    storage,
    /checkUnsolicitedGate \? await slurp\.getSettings\(\) : null;[\s\S]{0,200}if \(gateSettings\?\.messagesCreatorDmsPaused\) return null;/u,
    "every unasked send path (openers, drama questions, check-ins) is dropped at write time",
  );

  assert.match(
    storage,
    /if \(unasked && \(await slurp\.getSettings\(\)\)\.messagesCreatorDmsPaused\) return null;\s*const opened = await context\.storage\.openThread/u,
    "sendCreatorMessage drops an unasked text before it opens an empty chat",
  );
  const server = `${PACKAGES}/server/src/slp`;
  for (const [file, guard, opens] of [
    [
      "features/world/slp-world-operation.ts",
      "!messaging.proactiveMessages || settings.messagesCreatorDmsPaused",
      "planSlurpCreatorCheckIn(input)",
    ],
    ["features/world/slp-drama-service.ts", 'messagesCreatorDmsPaused) return "drop";', "openThread("],
    ["features/messages/slp-partner-texts-service.ts", "messagesCreatorDmsPaused) return;", "openThread("],
  ]) {
    const source = slurp2Source(`${server}/${file}`);
    const at = source.indexOf(guard);
    assert.ok(at >= 0, `${file} checks the pause`);
    assert.ok(at < source.indexOf(opens), `${file} checks the pause before it opens a chat`);
  }

  const scheduler = slurp2Source(`${PACKAGES}/server/src/slp/features/messages/slp-follow-up-scheduler-service.ts`);
  const branch = scheduler.match(/if \(settings\.messagesCreatorDmsPaused\) \{([\s\S]*?)\n\s*continue;/u);
  assert.ok(branch, "the follow-up scheduler checks the pause");
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
