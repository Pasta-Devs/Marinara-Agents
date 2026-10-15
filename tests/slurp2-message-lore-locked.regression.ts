import assert from "node:assert/strict";
import { slpDeepDetailsSeatView } from "../packages/slurp2/src/engine/packages/server/src/slp/modules/messages/slp-deep-details-mask.ts";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// A Creator knows what is in her own locked posts, and the DM prompt carries matching lorebook entries
// the way posts do. Source-reading: the services import the host Engine, which this lane does not load.
const root = join(fileURLToPath(new URL("..", import.meta.url)), "packages/slurp2/src/engine/packages/server/src/slp");
const read = (path: string) => readFileSync(join(root, path), "utf8");
const dm = read("features/messages/slp-message-generation-service.ts");

// A: the locked body reaches the prompt; the unlock state stays beside it.
assert.doesNotMatch(dm, /contents not repeated here/u);
assert.match(dm, /content: protect\(post\.content\),/u);
assert.match(
  dm,
  /access: post\.access,\s+\.\.\.\(post\.access === "locked" \? \{ fanAlreadyUnlocked: Boolean\(post\.unlockedByFan\) \} : \{\}\)/u,
);

// B: lore is scanned from the recent chat, shown in the prompt (so in the Deep details messages), and gated by the setting.
assert.match(
  dm,
  /resolveSlurpLoreContext\(input\.db, \{\s+settings,\s+texts: input\.history\.slice\(-HISTORY_TURNS\)/u,
);
assert.match(dm, /worldLore: protect\(input\.loreContext\)/u);
assert.match(dm, /^\s+loreContext: lore\.text,$/mu);
const lore = read("data/host/slp-lore-context.ts");
assert.match(lore, /if \(!settings\.enableLorebookContext\) return empty;/u);
assert.match(lore, /catch \(error\) \{[^}]*return \{ \.\.\.empty,/u, "a failed scan never fails the message");
// "At Depth" entries have no chat to go into, so they join the text instead of vanishing.
assert.match(lore, /\.\.\.result\.depthEntries\.map\(\(entry\) => entry\.content\)/u);
// What the scan used and what had no room reach the reply's Deep details record.
assert.match(lore, /included: await nameEntries\(db, result\.activatedEntryIds\)/u);
assert.match(lore, /skipped: result\.budgetSkippedEntries\.map/u);
assert.match(dm, /lore: lore\.report,/u);
assert.match(dm, /content: raw,\s+lore,/u);
assert.match(
  read("features/messages/slp-message-deep-details-record.ts"),
  /\.\.\.\(ctx\.lore \? \{ lore: ctx\.lore \} : \{\}\)/u,
);
assert.match(
  read("features/feed/slp-generation-service.ts"),
  /resolveSlurpLoreContext\(db, \{/u,
  "posts share the helper",
);
console.log("slurp2 message lore + locked posts: ok");

// The fan seat's Deep details masks a locked body the fan has not unlocked; the Creator seat reads it all.
{
  const body = 'secret "set" body';
  const record = {
    version: 1,
    generatedAt: "",
    model: {},
    messages: [{ role: "user", content: JSON.stringify({ content: body }) + `\n${body}` }],
    rawResponse: `she said ${body}`,
    paidBodies: [body],
    chat: {},
  } as never;
  const short = slpDeepDetailsSeatView(
    { ...(record as object), paidBodies: ["a"], messages: [{ role: "user", content: "a cat" }] } as never,
    "viewer",
  );
  assert.equal(short.messages[0]?.content, "a cat", "a very short body is not masked");
  const fan = slpDeepDetailsSeatView(record, "viewer");
  assert.ok(!JSON.stringify(fan).includes("secret"), "fan seat sees no paid body");
  assert.ok(!("paidBodies" in fan), "the mask list never leaves the server");
  const creator = slpDeepDetailsSeatView(record, "creator");
  assert.match(JSON.stringify(creator), /secret/u);
  assert.ok(!("paidBodies" in creator));
}
