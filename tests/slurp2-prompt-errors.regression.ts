import assert from "node:assert/strict";
import { slurp2Source } from "./slurp2-source";

async function main() {
  const route = await slurp2Source(
    new URL("../packages/slurp2/src/engine/packages/server/src/routes/slurp-messages.routes.ts", import.meta.url),
  );
  const panel = await slurp2Source(
    new URL("../packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpMessages.tsx", import.meta.url),
  );

  assert.match(
    route,
    /if \(!isDebugAgentsEnabled\(\)\) return reply\.code\(404\)\.send\(\{ error: "Not Found", code: "debug_disabled" \}\)/u,
  );
  assert.match(route, /return reply\.code\(409\)\.send\(\{ error: "No text connection is configured\." \}\)/u);
  assert.match(panel, /promptDebugDisabled/u);
  assert.match(panel, /promptNoConnection/u);
  assert.match(panel, /promptUnauthorized/u);
  assert.match(panel, /promptNotFound/u);
  assert.match(panel, /getSlurpPromptErrorKind\(query\.error\)/u);

  console.log("slurp2 prompt error classification regression: ok");
}

void main();
