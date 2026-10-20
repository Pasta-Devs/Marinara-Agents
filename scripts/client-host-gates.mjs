// Client bundle gates for the Engine's host namespace (Pasta-Devs/Marinara-Agents#1487).
//
// Guardrail 2, the client metafile gate: every Engine store, service or component the Engine hands packages through
// `__MARINARA_HOST__` must reach a client bundle only as its sources/host-client-overlay adapter, byte for byte. A
// vendored copy keeps its own state (the UI store copy reset Engine settings, #1478; the chat store copy left game
// boards unlocked). The Engine renders the one app dialog renderer, so AppDialogRenderer is never bundled, and only UNO
// owns an UNO game store.
//
// Guardrail 4, the client host-library gate: React, React Query, zustand, sonner, zod, i18next, framer-motion,
// tailwind-merge and clsx come from the Engine, so no client bundle may take them from node_modules. The libraries a
// package may still bundle are listed in BUNDLED_CLIENT_LIBRARIES.
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/** Engine client paths the host provides, relative to packages/client/src. */
export const HOST_CLIENT_PATHS = [
  "stores/ui.store.ts",
  "stores/chat.store.ts",
  "stores/agent.store.ts",
  "stores/sidecar.store.ts",
  "stores/dialog.store.ts",
  "stores/gallery.store.ts",
  "stores/encounter.store.ts",
  "stores/game-state.store.ts",
  "stores/backfill.store.ts",
  "lib/tts-service.ts",
  "lib/app-dialogs.ts",
  "lib/api-client.ts",
  "lib/emoji-catalog.generated.ts",
  "components/ui/Modal.tsx",
];

const CLIENT_SOURCE = "packages/client/src/";
const DIALOG_RENDERER = "components/ui/AppDialogRenderer.tsx";
const UNO_GAME_STORE = "stores/uno-game.store.ts";

/** Libraries the Engine provides through `__MARINARA_HOST__.modules`, with the packages they pull in. */
export const HOST_PROVIDED_LIBRARIES = [
  "react",
  "react-dom",
  "scheduler",
  "@tanstack/react-query",
  "@tanstack/query-core",
  "zustand",
  "sonner",
  "zod",
  "i18next",
  "react-i18next",
  "html-parse-stringify",
  "framer-motion",
  "motion-dom",
  "motion-utils",
  "tailwind-merge",
  "clsx",
  "use-sync-external-store",
];

/** node_modules a client bundle may still carry: tree-shaken per icon, or not in the Engine at all. */
export const BUNDLED_CLIENT_LIBRARIES = ["lucide-react", "chess.js"];

const normalize = (path) => path.split("\\").join("/");

/** The library a metafile input belongs to, or null for a source file. */
export function nodeModulesLibrary(input) {
  const match = /(?:^|\/)node_modules\/(?:\.pnpm\/[^/]+\/node_modules\/)?((?:@[^/]+\/)?[^/]+)/u.exec(normalize(input));
  return match ? match[1] : null;
}

/** The path under packages/client/src an input stands for, or null. The last occurrence wins (temp roots nest). */
export function clientSourcePath(input) {
  const path = normalize(input);
  const index = path.lastIndexOf(CLIENT_SOURCE);
  return index === -1 ? null : path.slice(index + CLIENT_SOURCE.length);
}

/**
 * The inputs that put bytes into the bundle. esbuild's `inputs` also lists every file it parsed and then dropped as
 * unused; a fixture metafile with no outputs is read as fully bundled.
 */
export function bundledInputs(metafile) {
  const outputs = Object.values(metafile.outputs ?? {});
  if (!outputs.length) return Object.keys(metafile.inputs ?? {});
  return [
    ...new Set(
      outputs.flatMap((output) =>
        Object.entries(output.inputs ?? {})
          .filter(([, input]) => input.bytesInOutput > 0)
          .map(([path]) => path),
      ),
    ),
  ];
}

/**
 * Guardrail 2. `readInput(input)` returns the bundled file's bytes (inputs are relative to the build's working
 * directory); `overlayRoot` is sources/host-client-overlay.
 */
export function assertClientMetafileUsesHost({ packageId, metafile, readInput, overlayRoot }) {
  const problems = [];
  for (const input of bundledInputs(metafile)) {
    if (nodeModulesLibrary(input)) continue;
    const clientPath = clientSourcePath(input);
    if (!clientPath) continue;
    if (clientPath === DIALOG_RENDERER) {
      problems.push(`bundles ${DIALOG_RENDERER}; the Engine renders the one app dialog renderer`);
    } else if (clientPath === UNO_GAME_STORE && packageId !== "uno") {
      problems.push(`bundles ${UNO_GAME_STORE}, which only UNO owns`);
    } else if (HOST_CLIENT_PATHS.includes(clientPath)) {
      const overlay = readFileSync(join(overlayRoot, CLIENT_SOURCE, clientPath));
      if (!overlay.equals(readInput(input))) {
        problems.push(`bundles a copy of the Engine's ${clientPath}; only the sources/host-client-overlay adapter may`);
      }
    }
  }
  if (problems.length) throw new Error(`${packageId} client: ${problems.join("; ")}`);
}

/** Guardrail 4. */
export function assertClientBundlesNoHostLibraries({ packageId, metafile }) {
  const problems = new Set();
  for (const input of bundledInputs(metafile)) {
    const library = nodeModulesLibrary(input);
    if (!library || BUNDLED_CLIENT_LIBRARIES.includes(library)) continue;
    problems.add(
      HOST_PROVIDED_LIBRARIES.includes(library)
        ? `bundles ${library}, which the Engine provides through __MARINARA_HOST__`
        : `bundles ${library}, which is not a client library packages may bundle (${BUNDLED_CLIENT_LIBRARIES.join(", ")})`,
    );
  }
  if (problems.size) throw new Error(`${packageId} client: ${[...problems].join("; ")}`);
}

/** Both client gates over one esbuild metafile whose inputs are relative to `workingDir`. */
export function assertClientHostGates({ packageId, metafile, workingDir, overlayRoot }) {
  assertClientBundlesNoHostLibraries({ packageId, metafile });
  assertClientMetafileUsesHost({
    packageId,
    metafile,
    overlayRoot,
    readInput: (input) => readFileSync(resolve(workingDir, input)),
  });
}
