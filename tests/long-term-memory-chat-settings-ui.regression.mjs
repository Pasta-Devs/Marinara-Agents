import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

function readSource(file) {
  return readFileSync(
    new URL(
      `../packages/long-term-memory/src/engine/packages/client/src/features/long-term-memory/${file}`,
      import.meta.url,
    ),
    "utf8",
  );
}

const chatSettings = readSource("ChatSettings.tsx");
const controls = readSource("shared-controls.tsx");
const lastInjection = readSource("LastInjectionSummary.tsx");

assert.match(chatSettings, /data-ltm-density="compact"/u);
assert.match(chatSettings, /className=\{compactInputClass\}/u);
assert.equal((chatSettings.match(/\scompact\n/gu) ?? []).length, 4);
assert.doesNotMatch(chatSettings, /space-y-2 px-2/u);

assert.match(controls, /mari-editor-field min-h-8 w-full px-2\.5 text-\[0\.6875rem\]/u);
assert.match(controls, /compact \? "h-7 w-7" : "h-11 w-11"/u);
assert.match(controls, /compact \? compactInputClass : inputClass/u);
assert.match(lastInjection, /compact \? "min-h-8 gap-2 px-2\.5 py-1\.5 text-\[0\.625rem\]"/u);
assert.match(lastInjection, /compact \? "min-h-7" : "min-h-9"/u);

process.stdout.write("Long-Term Memory chat settings UI regression: compact spacing, controls, and typography ok\n");
