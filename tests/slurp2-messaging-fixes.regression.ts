import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source";

async function main() {
  const panel = await slurp2Source(
    new URL("../packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpMessages.tsx", import.meta.url),
  );
  const route = await slurp2Source(
    new URL("../packages/slurp2/src/engine/packages/server/src/routes/slurp-messages.routes.ts", import.meta.url),
  );

  assert.match(panel, /pending\.content === message\.content|message\.content === pending\.content/u);
  assert.match(panel, /!hiddenReplyIds\.has\(message\.id\)/u);
  assert.match(panel, /creatorAvailability\s*\?\?\s*relationship\?\.availability/u);
  assert.match(panel, /mode="choose"/u);
  assert.match(panel, /message\.kind === "tip"/u);
  assert.match(route, /messages\/threads\/:threadId\/request-reply/u);
  assert.match(route, /generationGuidance:/u);

  console.log("slurp2 messaging fixes regression: ok");
}

void main();
