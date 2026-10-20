// A stand-in for the Engine's `globalThis.__MARINARA_HOST__` (capability API 1.341) for browser fixtures that load a
// package client.js outside the Engine app. Package clients take React, React Query and the other host libraries from
// that namespace instead of bundling them (Pasta-Devs/Marinara-Agents#1487), so a bare page must provide it first.
//
// It carries the Engine's own libraries and its QueryClient (packages/client/src/lib/query-client.ts) from
// MARINARA_ENGINE_ROOT, and no stores or services: a package that needs those reads the adapters' fallbacks here.
// Serve the returned script as a module before the package's client.js.
import { createRequire } from "node:module";
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { HOST_MODULE_SPECIFIERS } from "../scripts/esbuild-host-plugins.mjs";

export async function buildPackageHostFixture(engineRoot: string): Promise<string> {
  const clientRoot = join(engineRoot, "packages/client");
  const esbuild = createRequire(pathToFileURL(join(engineRoot, "package.json")))("esbuild") as typeof import("esbuild");
  const imports = HOST_MODULE_SPECIFIERS.map(
    (specifier, index) => `import * as m${index} from ${JSON.stringify(specifier)};`,
  );
  const modules = HOST_MODULE_SPECIFIERS.map((specifier, index) => `${JSON.stringify(specifier)}: m${index}`);
  const contents = `${imports.join("\n")}
import { queryClient } from ${JSON.stringify(join(clientRoot, "src/lib/query-client.ts"))};
Object.defineProperty(globalThis, "__MARINARA_HOST__", {
  value: Object.freeze({
    version: 1,
    capabilityApi: Object.freeze({ major: 1, minor: 341 }),
    stores: Object.freeze({}),
    services: Object.freeze({}),
    modules: Object.freeze({ ${modules.join(", ")} }),
    queryClient,
    components: Object.freeze({}),
    data: Object.freeze({}),
  }),
});
`;
  const result = await esbuild.build({
    stdin: { contents, resolveDir: clientRoot, loader: "ts" },
    absWorkingDir: clientRoot,
    bundle: true,
    format: "esm",
    platform: "browser",
    target: "es2020",
    define: { "process.env.NODE_ENV": '"production"' },
    logLevel: "silent",
    write: false,
  });
  return result.outputFiles[0]!.text;
}
