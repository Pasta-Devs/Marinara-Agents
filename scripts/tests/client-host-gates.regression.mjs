// The client bundle gates run on every package client the feature build makes (Pasta-Devs/Marinara-Agents#1487).
// Guardrail 2: an Engine store, service or component the host provides reaches a bundle only as its
// sources/host-client-overlay adapter, byte for byte; AppDialogRenderer is never bundled; only UNO owns its game store.
// Guardrail 4: no bundle takes a host-provided library (React, React Query, zustand, sonner, zod, i18next,
// framer-motion, tailwind-merge, clsx and what they pull in) from node_modules; only lucide-react and chess.js may.
// The fixtures are metafiles shaped like esbuild's, with inputs relative to the build's working directory.
// Run: node scripts/tests/client-host-gates.regression.mjs
import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import {
  HOST_CLIENT_PATHS,
  assertClientBundlesNoHostLibraries,
  assertClientHostGates,
  clientSourcePath,
  nodeModulesLibrary,
} from "../client-host-gates.mjs";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "../..");
const overlayRoot = join(repoRoot, "sources/host-client-overlay");
const temporary = await mkdtemp(join(tmpdir(), "client-host-gates-"));
const workingDir = join(temporary, "engine");
const buildRoot = join(temporary, "build-root");
await mkdir(workingDir, { recursive: true });
// A build root as prepareFeatureBuildRoot stacks it: vendored Engine sources, then the host client overlay.
await cp(join(repoRoot, "sources/engine/packages/client/src/stores"), join(buildRoot, "packages/client/src/stores"), {
  recursive: true,
});
await cp(overlayRoot, buildRoot, { recursive: true, force: true });

const input = (path) => relative(workingDir, join(buildRoot, "packages/client/src", path));
const metafile = (...inputs) => ({
  inputs: Object.fromEntries(inputs.map((path) => [path, { bytes: 1, imports: [] }])),
});
const gates = (packageId, ...inputs) =>
  assertClientHostGates({ packageId, metafile: metafile(...inputs), workingDir, overlayRoot });

// Paths: esbuild's pnpm layout (`.pnpm/<pkg>@<v>/node_modules/<pkg>`) and nested temporary roots.
assert.equal(nodeModulesLibrary(".pnpm/react@19.3.0/node_modules/react/index.js"), "react");
assert.equal(nodeModulesLibrary("../node_modules/@tanstack/query-core/build/modern/index.js"), "@tanstack/query-core");
assert.equal(nodeModulesLibrary("../tmp/marinara-noodle-source-x/packages/client/src/App.tsx"), null);
assert.equal(clientSourcePath("../../tmp/a/packages/client/src/stores/ui.store.ts"), "stores/ui.store.ts");
assert.equal(clientSourcePath("marinara-host-module:react"), null);

// A rebuilt game: the overlay adapters, the shims, a package-owned store, and lucide-react.
gates(
  "chess",
  ...HOST_CLIENT_PATHS.map(input),
  input("stores/chess-game.store.ts"),
  "marinara-host-module:react",
  "marinara-host:marinara:host",
  ".pnpm/lucide-react@0.513.0_react@19.3.0/node_modules/lucide-react/dist/esm/icons/x.js",
);
gates("uno", input("stores/uno-game.store.ts"));

// Guardrail 2 refusals.
const vendoredUi = relative(workingDir, join(repoRoot, "sources/engine/packages/client/src/stores/ui.store.ts"));
assert.throws(
  () => gates("tic-tac-toe", vendoredUi),
  /tic-tac-toe client: bundles a copy of the Engine's stores\/ui\.store\.ts; only the sources\/host-client-overlay adapter may/u,
);
await writeFile(
  join(buildRoot, "packages/client/src/lib/api-client.ts"),
  "export const api = {}; // a package's own\n",
);
assert.throws(() => gates("slurp2", input("lib/api-client.ts")), /bundles a copy of the Engine's lib\/api-client\.ts/u);
assert.throws(
  () => gates("noodle", input("components/ui/AppDialogRenderer.tsx")),
  /bundles components\/ui\/AppDialogRenderer\.tsx; the Engine renders the one app dialog renderer/u,
);
assert.throws(
  () => gates("chess", input("stores/uno-game.store.ts")),
  /stores\/uno-game\.store\.ts, which only UNO owns/u,
);
// A file esbuild parsed and then dropped as unused is not in the bundle; one that put bytes into it is.
const unoStore = input("stores/uno-game.store.ts");
const withOutput = (bytesInOutput) => ({
  inputs: { [unoStore]: { bytes: 267, imports: [] } },
  outputs: { "client.js": { bytes: 9, inputs: { [unoStore]: { bytesInOutput } } } },
});
assertClientHostGates({ packageId: "chess", metafile: withOutput(0), workingDir, overlayRoot });
assert.throws(
  () => assertClientHostGates({ packageId: "chess", metafile: withOutput(9), workingDir, overlayRoot }),
  /which only UNO owns/u,
);

// Guardrail 4 refusals: every host-provided library, and anything not on the bundled list.
for (const library of [
  ".pnpm/react@19.3.0/node_modules/react/index.js",
  ".pnpm/react-dom@19.3.0_react@19.3.0/node_modules/react-dom/cjs/react-dom-client.production.js",
  ".pnpm/scheduler@0.28.0/node_modules/scheduler/index.js",
  ".pnpm/@tanstack+query-core@5.0.0/node_modules/@tanstack/query-core/build/modern/query.js",
  "node_modules/zod/lib/index.mjs",
  ".pnpm/i18next@26.4.2/node_modules/i18next/dist/esm/i18next.js",
  ".pnpm/html-parse-stringify@3.0.1/node_modules/html-parse-stringify/dist/html-parse-stringify.module.js",
  ".pnpm/motion-dom@13.3.0/node_modules/motion-dom/dist/es/index.mjs",
  ".pnpm/use-sync-external-store@1.5.0/node_modules/use-sync-external-store/shim/index.js",
]) {
  const name = nodeModulesLibrary(library);
  assert.throws(
    () => assertClientBundlesNoHostLibraries({ packageId: "noodle", metafile: metafile(library) }),
    new RegExp(
      `noodle client: bundles ${name.replace("/", "\\/")}, which the Engine provides through __MARINARA_HOST__`,
      "u",
    ),
  );
}
assert.throws(
  () =>
    assertClientBundlesNoHostLibraries({ packageId: "noodle", metafile: metafile("node_modules/left-pad/index.js") }),
  /bundles left-pad, which is not a client library packages may bundle \(lucide-react, chess\.js\)/u,
);
assertClientBundlesNoHostLibraries({
  packageId: "chess",
  metafile: metafile("node_modules/chess.js/dist/esm/chess.js"),
});

await rm(temporary, { recursive: true, force: true });
console.log("client host gates: ok");
