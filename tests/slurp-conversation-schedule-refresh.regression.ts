import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { resolveSlurpCreatorAvailability } from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-creator-schedule-context";
import { SLURP_DEFAULT_REPLY_DELAYS } from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-messaging";

const root = "packages/slurp2/src/engine/packages";
async function main() {
  const [settings, hooks, routes, generator] = await Promise.all([
    readFile(`${root}/client/src/components/slurp/SlurpSettings.tsx`, "utf8"),
    readFile(`${root}/client/src/hooks/use-slurp.ts`, "utf8"),
    readFile(`${root}/server/src/routes/slurp.routes.ts`, "utf8"),
    readFile(`${root}/server/src/services/slurp/slurp-conversation-schedule-generation.ts`, "utf8"),
  ]);

  assert.match(settings, /postingSchedule/u, "the existing schedule action must identify Slurp post timing");
  assert.match(settings, /refreshConversationSchedule/u, "Creator settings must expose Conversation Schedule refresh");
  assert.match(settings, /showConfirmDialog/u, "refreshing a character schedule must require confirmation");
  assert.match(hooks, /conversation-schedule\/refresh/u);
  assert.match(routes, /conversation-schedule\/refresh/u);
  assert.match(routes, /conversationSchedule: \{ \.\.\.generated/u);
  assert.match(generator, /Include all seven days/u);
  assert.match(generator, /Return only one JSON object/u);

  // #128: feedback must not depend on per-call mutate() callbacks, which die with the caller.
  const hook = hooks.slice(hooks.indexOf("export function useRefreshNoodlerConversationSchedule"));
  const hookBody = hook.slice(0, hook.indexOf("\nexport function"));
  assert.match(hookBody, /toast\.success/u, "schedule refresh success toast must live in the hook");
  assert.match(hookBody, /toast\.error/u, "schedule refresh error toast must live in the hook");
  assert.doesNotMatch(settings, /refreshConversationSchedule\.mutate\([^)]*\{/u);

  // Creators with no active schedule get a guessed away status, and the guess must be labelled.
  const now = new Date("2026-08-18T12:00:00.000Z");
  const guessed = await resolveSlurpCreatorAvailability(
    { getById: async () => null },
    { kind: "character", entityId: "c1", displayName: "Ari" },
    undefined,
    now,
    new Date(now.getTime() - 5 * 60 * 60_000).toISOString(),
    { ...SLURP_DEFAULT_REPLY_DELAYS, messagesUnscheduledAlwaysReachable: false },
  );
  assert.equal(guessed.online, false);
  assert.equal(guessed.estimated, true, "availability inferred from posts must be flagged as estimated");
  const messagesUi = await readFile(`${root}/client/src/components/slurp/SlurpMessages.tsx`, "utf8");
  assert.match(messagesUi, /availability\.estimated/u, "the away status must label estimated availability");

  console.log("Slurp Conversation Schedule refresh wiring passed.");
}

void main();
