import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(
  join(import.meta.dirname, "../packages/slurp2/src/engine/packages/client/src/slp/app/screens/SlpScreenWallet.tsx"),
  "utf8",
);

assert.match(source, /import \{[^}]*\bLock\b[^}]*\} from "lucide-react";/u);
assert.match(source, /icon: Lock/u);

console.log("slurp2 wallet regression passed");
