import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  moveSlurpAutopurgeDate,
  nextSlurpAutopurgeRunAt,
} from "../packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-autopurge-time.ts";

const root = join(import.meta.dirname, "..");
const read = (path: string) => readFileSync(join(root, path), "utf8");

assert.equal(
  moveSlurpAutopurgeDate(new Date("2026-03-31T18:30:00.000Z"), 1, "months", -1).toISOString(),
  "2026-02-28T18:30:00.000Z",
  "calendar months must clamp at the end of shorter months",
);
assert.equal(
  moveSlurpAutopurgeDate(new Date("2026-09-14T08:15:00.000Z"), 4, "weeks", -1).toISOString(),
  "2026-08-17T08:15:00.000Z",
);
assert.equal(
  nextSlurpAutopurgeRunAt(
    { autopurgeRetentionValue: 4, autopurgeRetentionUnit: "weeks" },
    new Date("2026-09-14T08:15:00.000Z"),
  ),
  "2026-10-12T08:15:00.000Z",
);

const operation = read("packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-autopurge.ts");
const scheduler = read(
  "packages/slurp2/src/engine/packages/server/src/services/slurp/slurp-autopurge-scheduler.service.ts",
);
const serverEntry = read("packages/slurp2/src/engine/packages/server/src/services/slurp/server-entry.ts");
const settings = read("packages/slurp2/src/engine/packages/server/src/services/storage/slurp.storage.ts");
const client = read("packages/slurp2/src/engine/packages/client/src/components/slurp/SlurpSettings.tsx");

assert.match(
  settings,
  /autopurgeEnabled: false,[\s\S]*autopurgeRetentionValue: 4,[\s\S]*autopurgeRetentionUnit: "weeks"/u,
);
assert.match(settings, /autopurgeKeepPosts: true,[\s\S]*autopurgeIncludeMessageMedia: false/u);
assert.match(operation, /postsToStrip[\s\S]*imageUrl: null[\s\S]*metadata: JSON\.stringify/u);
assert.doesNotMatch(
  operation.slice(operation.indexOf("for (const post of postsToStrip)"), operation.indexOf("for (const message")),
  /imagePrompt:/u,
  "media-only purges must preserve the post prompt",
);
assert.doesNotMatch(
  operation.slice(operation.indexOf("for (const message of messagesToStrip)"), operation.indexOf("if (deletedPostIds")),
  /content:/u,
  "message-media purges must preserve message text",
);
assert.match(operation, /trySlurpDataDeletion/u, "manual and scheduled purges must use the destructive-work lock");
assert.match(scheduler, /if \(Date\.parse\(settings\.autopurgeNextRunAt\) > Date\.now\(\)\) return;/u);
assert.match(scheduler, /void pollNow\(\);/u, "the scheduler must check for overdue work during startup");
assert.match(serverEntry, /startSlurpAutopurgeScheduler\(app, addTeardown\)/u);
assert.match(client, /type="datetime-local"/u);
assert.match(client, /ui\.slurp\.settings\.autopurge\.runConfirmPosts/u);
assert.match(client, /ui\.slurp\.settings\.autopurge\.runConfirmPostsWithMessages/u);

console.log("slurp2 autopurge regression passed");
