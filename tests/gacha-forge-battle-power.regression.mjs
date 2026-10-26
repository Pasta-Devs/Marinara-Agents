import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { test } from "node:test";

const client = await readFile(new URL("../packages/gacha-forge/client.js", import.meta.url), "utf8");

// The in-game What's-new list keeps past releases as they were written: cut it out, string by string.
function withoutWhatsNew(source) {
  const start = source.indexOf("var oy=[");
  assert.ok(start >= 0, "the What's-new list is in the bundle");
  let depth = 0,
    quote = null;
  for (let at = start + "var oy=".length; at < source.length; at++) {
    const char = source[at];
    if (quote) {
      if (char === "\\") at++;
      else if (char === quote) quote = null;
    } else if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "[") depth++;
    else if (char === "]" && --depth === 0) return source.slice(0, start) + source.slice(at + 1);
  }
  assert.fail("the What's-new list ends");
}

test("player-facing text says Battle Power (BP), never CP or Combat Power", () => {
  // CSS comments are notes for developers, not text a player reads.
  const text = withoutWhatsNew(client).replace(/\/\*[\s\S]*?\*\//gu, "");
  const left = [...text.matchAll(/(^|[^A-Za-z0-9_$.])(CP|Combat Power)(?=[^A-Za-z0-9_$]|$)/gu)].map((match) =>
    text.slice(match.index - 40, match.index + 40),
  );
  assert.deepEqual(left, []);
  assert.match(client, /q:"What is BP\?"/u);
  assert.match(client, /\{version:"1\.24\.3",changed:\["Combat Power \(CP\) is now called Battle Power \(BP\)\."\]/u);
  // Only the words change: the sort id and the data fields keep their names, so no saved data moves.
  assert.match(client, /\["cp","BP"\],\["level","Level"\]/u);
  assert.match(client, /var vw=\[\["cp","BP gain"\]/u);
});
