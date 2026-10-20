import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { PROFESSOR_MARI_CHARACTER_ID } from "../packages/long-term-memory/src/engine/packages/server/src/services/long-term-memory/sources/interop.ts";

// Long-Term Memory reads these Engine-owned chat metadata fields and the built-in assistant id directly.
// The list is documented in packages/long-term-memory/docs/ARCHITECTURE.md (Boundaries); keep both in step.
const chatMetadataFields = [
  "daySummaries",
  "weekSummaries",
  "summaryEntries",
  "summary",
  "gamePreviousSessionSummaries",
];

const repoRoot = resolve(dirname(process.argv[1] ?? process.cwd()), "..");
const engineRoot = resolve(process.env.MARINARA_ENGINE_ROOT || join(repoRoot, "../Marinara-Engine"));

async function main() {
  const defaults = await import(pathToFileURL(join(engineRoot, "packages/shared/src/constants/defaults.ts")).href);
  assert.equal(
    PROFESSOR_MARI_CHARACTER_ID,
    defaults.PROFESSOR_MARI_ID,
    "the Engine's built-in assistant id changed; Long-Term Memory would list the assistant as a source and place",
  );

  // The summary fields exist only as TypeScript types, so read the ChatMetadata declaration itself.
  const chatTypes = readFileSync(join(engineRoot, "packages/shared/src/types/chat.ts"), "utf8");
  const declaration = /^export interface ChatMetadata \{\n([\s\S]*?)^\}/mu.exec(chatTypes)?.[1];
  assert.ok(declaration, "ChatMetadata is no longer declared in packages/shared/src/types/chat.ts");
  const missing = chatMetadataFields.filter((field) => !new RegExp(`^ {2}${field}\\??:`, "mu").test(declaration));
  assert.deepEqual(
    missing,
    [],
    `the Engine's ChatMetadata no longer declares ${missing.join(", ")}; Sources would stop finding those summaries`,
  );
  console.log(`Long-Term Memory Engine fields ok: ${chatMetadataFields.length} chat fields and the assistant id`);
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? (error.stack ?? error.message) : String(error)}\n`);
  process.exitCode = 1;
});
