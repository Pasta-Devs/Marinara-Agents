import assert from "node:assert/strict";
import { join } from "node:path";
import { isSlurpFileUniqueConstraintError } from "../packages/slurp2/src/engine/packages/server/src/slp/base/host/slp-file-errors.js";
import { slurp2Source } from "./slurp2-source";

const hostError = {
  name: "FileUniqueConstraintError",
  code: "FILE_UNIQUE_CONSTRAINT",
  table: "slurp2_message_claims",
  keys: ["threadId"],
};

assert.equal(
  isSlurpFileUniqueConstraintError(hostError, "slurp2_message_claims", ["threadId"]),
  true,
  "host-created storage errors must match without sharing the package's class identity",
);
assert.equal(isSlurpFileUniqueConstraintError(hostError, "slurp2_threads", ["threadId"]), false);
assert.equal(isSlurpFileUniqueConstraintError({ ...hostError, code: "OTHER" }, "slurp2_message_claims"), false);
assert.equal(isSlurpFileUniqueConstraintError(new Error(hostError.name), "slurp2_message_claims"), false);

const sourceRoot = join(process.cwd(), "packages/slurp2/src/engine/packages/server/src");
const consumers = [
  "routes/slurp.routes.ts",
  "services/slurp/slurp-world.operation.ts",
  "services/storage/slurp-messages.storage.ts",
  "services/storage/slurp-reply-methods.ts",
  "services/storage/slurp-reply-queue.storage.ts",
  "services/storage/slurp.storage.ts",
];
for (const relativePath of consumers) {
  const source = slurp2Source(join(sourceRoot, relativePath));
  assert.match(source, /isSlurpFileUniqueConstraintError/u, `${relativePath} must use the cross-bundle guard`);
  assert.doesNotMatch(source, /isFileUniqueConstraintError/u, `${relativePath} must not use instanceof matching`);
}

console.log("slurp2 cross-bundle unique-error regression checks passed");
