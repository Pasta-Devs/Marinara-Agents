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
import { readHostContractSpecifiers, readHostModuleImports } from "../scripts/esbuild-host-plugins.mjs";

// `toaster: true` also mounts the one sonner Toaster the Engine's App.tsx mounts, in its own root appended to
// document.body, so a package's `toast()` calls render in the fixture page. It shares the bundled `sonner` module with
// the host namespace, so a toast raised by the package reaches it. The package itself never mounts a Toaster.
// `agentStore: true` adds `stores.agent`, whose `getState()` returns whatever the page's `globalThis.__agentState()` gives
// (an empty state until a test sets it), so a test can stand in for the Engine's agent store; the stores stay frozen.
export async function buildPackageHostFixture(
  engineRoot: string,
  options: { toaster?: boolean; agentStore?: boolean } = {},
): Promise<string> {
  const clientRoot = join(engineRoot, "packages/client");
  const esbuild = createRequire(pathToFileURL(join(engineRoot, "package.json")))("esbuild") as typeof import("esbuild");
  const specifiers: string[] = readHostContractSpecifiers(engineRoot);
  const moduleImports = readHostModuleImports(engineRoot, specifiers);
  const imports = specifiers.map(
    (specifier, index) => `import * as m${index} from ${JSON.stringify(moduleImports[specifier])};`,
  );
  const modules = specifiers.map((specifier, index) => `${JSON.stringify(specifier)}: m${index}`);
  const contents = `${imports.join("\n")}
import { queryClient } from ${JSON.stringify(join(clientRoot, "src/lib/query-client.ts"))};
import { supportedCapabilityApi } from ${JSON.stringify(join(engineRoot, "packages/shared/src/schemas/capability-package.schema.ts"))};
Object.defineProperty(globalThis, "__MARINARA_HOST__", {
  value: Object.freeze({
    version: 1,
    capabilityApi: supportedCapabilityApi,
    stores: Object.freeze({ ${options.agentStore ? "agent: { getState: () => globalThis.__agentState?.() ?? {} }" : ""} }),
    services: Object.freeze({}),
    modules: Object.freeze({ ${modules.join(", ")} }),
    queryClient,
    components: Object.freeze({}),
    data: Object.freeze({}),
  }),
});
${
  options.toaster
    ? `import { createElement } from "react";
import { createRoot } from "react-dom/client";
import { Toaster } from ${JSON.stringify(moduleImports["sonner"] ?? "sonner")};
const mountToaster = () => {
  const root = document.createElement("div");
  root.setAttribute("data-test-toaster-root", "");
  document.body.appendChild(root);
  createRoot(root).render(createElement(Toaster, { position: "top-center" }));
};
if (document.body) mountToaster();
else document.addEventListener("DOMContentLoaded", mountToaster, { once: true });
`
    : ""
}`;
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
