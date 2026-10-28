// The server bundle gates in scripts/server-host-gates.mjs, on fixture metafiles (Pasta-Devs/Marinara-Agents#1487):
// an overlay file passes only while it is the overlay's own copy, a vendored Tier A module or a bundled host library
// fails, and the Tier B list is a ratchet that needs a written reason per module.
// Run: node scripts/tests/server-host-gates.regression.mjs
import assert from "node:assert/strict";
import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { classifyServerMetafile, serverHostGateFailures } from "../server-host-gates.mjs";

const scratch = await realpath(await mkdtemp(join(tmpdir(), "server-host-gates-")));
try {
  const buildRoot = join(scratch, "build");
  const overlayRoot = join(scratch, "overlay");
  const packageRoot = join(scratch, "package");
  const write = async (path, content) => {
    await mkdir(dirname(path), { recursive: true });
    await writeFile(path, content);
  };
  const server = "packages/server/src";
  await write(join(overlayRoot, server, "lib/logger.ts"), "export const logger = hostLogger;\n");
  await write(join(buildRoot, server, "lib/logger.ts"), "export const logger = hostLogger;\n");
  await write(join(overlayRoot, server, "services/llm/provider-registry.ts"), "overlay\n");
  await write(join(buildRoot, server, "services/llm/provider-registry.ts"), "vendored copy\n");
  await write(join(buildRoot, server, "services/sidecar/sidecar-model.service.ts"), "vendored\n");
  await write(join(buildRoot, server, "services/storage/chats.storage.ts"), "reads\n");
  await write(join(buildRoot, server, "services/storage/noodle.storage.ts"), "package-owned\n");
  await write(join(packageRoot, server, "services/storage/noodle.storage.ts"), "package-owned\n");
  await write(join(buildRoot, server, "db/schema/chats.ts"), "table\n");
  await write(join(buildRoot, "node_modules/.pnpm/zod@3.25.76/node_modules/zod/index.js"), "zod\n");
  await write(join(buildRoot, "node_modules/lucide-react/index.js"), "icons\n");

  const input = (path) => join(buildRoot, path);
  const metafile = {
    inputs: {
      [input(`${server}/lib/logger.ts`)]: { imports: [{ path: "pino", external: true }] },
      [input(`${server}/services/llm/provider-registry.ts`)]: { imports: [] },
      [input(`${server}/services/sidecar/sidecar-model.service.ts`)]: { imports: [] },
      [input(`${server}/services/storage/chats.storage.ts`)]: { imports: [{ path: "zod", external: true }] },
      [input(`${server}/services/storage/noodle.storage.ts`)]: { imports: [] },
      [input(`${server}/db/schema/chats.ts`)]: { imports: [] },
      [input("node_modules/.pnpm/zod@3.25.76/node_modules/zod/index.js")]: { imports: [] },
      [input("node_modules/lucide-react/index.js")]: { imports: [] },
    },
  };
  const classified = classifyServerMetafile({
    metafile,
    cwd: scratch,
    buildRoot,
    overlayRoot,
    packageSourceRoot: packageRoot,
  });
  assert.deepEqual(classified.overlay, [`${server}/lib/logger.ts`], "the overlay's own copy passes");
  assert.deepEqual(
    classified.tierA,
    [`${server}/services/llm/provider-registry.ts`, `${server}/services/sidecar/sidecar-model.service.ts`],
    "a vendored copy, or an overlay path whose content drifted, is Tier A",
  );
  assert.deepEqual(classified.tierB, [`${server}/db/schema/chats.ts`, `${server}/services/storage/chats.storage.ts`]);
  assert.deepEqual(classified.libraries, ["lucide-react", "zod"]);
  assert.deepEqual(classified.bareImports, ["pino", "zod"]);

  const baseline = {
    reasons: {
      [`${server}/db/schema/chats.ts`]: "stateless: verified",
      [`${server}/services/storage/chats.storage.ts`]: "",
    },
    packages: { noodle: [`${server}/db/schema/chats.ts`, `${server}/services/storage/chats.storage.ts`] },
  };
  const failures = serverHostGateFailures("noodle", classified, baseline);
  assert.equal(failures.length, 5, failures.join("\n"));
  assert.ok(failures.some((failure) => failure.includes("bundles the Engine's packages/server/src/services/sidecar/")));
  assert.ok(failures.some((failure) => failure.includes("bundles zod")));
  assert.ok(failures.some((failure) => failure.includes("imports pino")));
  assert.ok(
    failures.some((failure) =>
      failure.includes("chats.storage.ts in scripts/server-engine-modules-baseline.json needs a written reason"),
    ),
  );
  assert.ok(!failures.some((failure) => failure.includes("lucide-react")), "lucide-react may stay bundled");

  // The ratchet: a module not listed fails, and so does a listed one that is no longer bundled.
  const ratchet = serverHostGateFailures(
    "noodle",
    {
      ...classified,
      tierA: [],
      libraries: [],
      bareImports: [],
      tierB: [`${server}/db/schema/chats.ts`, `${server}/utils/data-dir.ts`],
    },
    {
      reasons: { [`${server}/db/schema/chats.ts`]: "ok", [`${server}/services/storage/chats.storage.ts`]: "ok" },
      packages: baseline.packages,
    },
  );
  assert.deepEqual(
    ratchet.map((failure) => failure.split(":")[1].trim().split(" ").slice(0, 3).join(" ")),
    ["bundles the Engine's", "packages/server/src/services/storage/chats.storage.ts is no"],
  );

  // A package outside Calls, Noodle and Slurp has no Tier B list, but the Tier A and library gates apply to it.
  const game = serverHostGateFailures(
    "chess",
    { ...classified, tierA: [], bareImports: ["pino"] },
    { reasons: {}, packages: {} },
  );
  assert.deepEqual(game, ["chess: bundles zod; it must come from the Engine (or not be imported at all)"]);

  // A package-owned file at a Tier A path is still a copy of the Engine's service: the package exemption never hides
  // it. A package-owned storage module stays exempt from Tier B.
  await write(join(buildRoot, server, "services/llm/local-sidecar.ts"), "package copy\n");
  await write(join(packageRoot, server, "services/llm/local-sidecar.ts"), "package copy\n");
  const packageCopy = classifyServerMetafile({
    metafile: {
      inputs: {
        [input(`${server}/services/llm/local-sidecar.ts`)]: { imports: [] },
        [input(`${server}/services/storage/noodle.storage.ts`)]: { imports: [] },
      },
    },
    cwd: scratch,
    buildRoot,
    overlayRoot,
    packageSourceRoot: packageRoot,
  });
  assert.deepEqual(packageCopy.tierA, [`${server}/services/llm/local-sidecar.ts`]);
  assert.deepEqual(packageCopy.tierB, []);

  console.log("server host gates regression passed");
} finally {
  await rm(scratch, { recursive: true, force: true });
}
