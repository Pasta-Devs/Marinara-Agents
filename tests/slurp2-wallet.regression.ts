import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(import.meta.dirname, "../packages/slurp2/src/engine/packages/client/src/slp/app/screens/SlpScreenWallet.tsx"),
  "utf8",
);

assert.match(source, /import \{ SlpLockGlyph \} from "..\/..\/base\/chrome\/SlpGlyphs";/u);
assert.match(source, /icon: SlpLockGlyph/u);

console.log("slurp2 wallet regression passed");
