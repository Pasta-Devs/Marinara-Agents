import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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

  console.log("Slurp Conversation Schedule refresh wiring passed.");
}

void main();
