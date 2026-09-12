import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

// A key missing from en.json renders as the raw key, e.g. a dialog button reading
// "capabilities.actions.cancel". Plural keys resolve through their `_one`/`_other` forms.
const clientRoot = "packages/slurp2/src/engine/packages/client/src";
const en = JSON.parse(readFileSync(join(clientRoot, "localization/locales/en.json"), "utf8")) as Record<string, string>;

const sources = (readdirSync(clientRoot, { recursive: true }) as string[]).filter((file) => /\.tsx?$/u.test(file));
const missing: string[] = [];
for (const file of sources) {
  const text = readFileSync(join(clientRoot, file), "utf8");
  for (const match of text.matchAll(/\b(?:t|localizeUi)\(\s*"([^"]+)"/gu)) {
    const key = match[1];
    if (!(key in en) && !(`${key}_one` in en) && !(`${key}_other` in en)) missing.push(`${file}: ${key}`);
  }
}

assert.deepEqual(missing, [], "every static slurp2 localization key must exist in en.json");
console.log("slurp2 locale keys regression passed");
