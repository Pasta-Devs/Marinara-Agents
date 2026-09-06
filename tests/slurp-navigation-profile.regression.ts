import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (name: string) =>
  readFileSync(`packages/slurp/src/engine/packages/client/src/components/slurp/${name}.tsx`, "utf8");

const shell = read("SlurpShell");
const card = read("SlurpCreatorProfileCard");
const profile = read("SlurpProfileSurface");
const home = read("SlurpHome");

assert.match(shell, /const switcherIdentity = creatorIdentity \?\? personaAccount/u);
assert.match(shell, /<Avatar account=\{switcherIdentity\}/u);
assert.match(shell, /ui\.slurp\.account\.asPersona/u);
assert.match(shell, /h-11 w-11 shrink-0[\s\S]*?focus-visible:ring-2/u);
assert.match(shell, /onClick=\{onOpenSettings\}[\s\S]*?focus-visible:ring-2/u);
assert.equal(
  (shell.match(/activeView === "(?:notifications|studio|wallet|settings)" && SLURP_ROW_ACTIVE_CLASS/gu) ?? []).length >=
    4,
  true,
);

assert.match(card, /rounded-md text-left focus-visible:outline-none focus-visible:ring-2/u);
assert.equal((card.match(/active:scale-\[0\.96\]/gu) ?? []).length >= 3, true);
assert.equal((card.match(/motion-reduce:active:scale-100/gu) ?? []).length >= 3, true);

assert.match(profile, /bioCollapsible\?: boolean/u);
assert.match(profile, /bioContent && !bioCollapsible/u);
assert.match(home, /bioCollapsible=\{profileBioBody\.length > 280 \|\| profileBioBody\.split\("\\n"\)\.length > 4\}/u);
assert.doesNotMatch(home, /profileBioQuote/u);

console.log("slurp navigation and profile regression passed");
