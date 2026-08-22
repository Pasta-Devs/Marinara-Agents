import assert from "node:assert/strict";
import { realpathSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

export async function compileEngineVisualStyles(engineRoot: string, packageClientSource: string) {
  const temporary = await mkdtemp(join(tmpdir(), "marinara-visual-styles-"));
  try {
    const input = join(temporary, "visual.css");
    const output = join(temporary, "dist");
    const engineClientRoot = join(engineRoot, "packages/client");
    await writeFile(
      input,
      `@import ${JSON.stringify(join(engineClientRoot, "src/styles/globals.css"))};\n@source ${JSON.stringify(packageClientSource)};\n`,
    );

    const vitePath = realpathSync(join(engineClientRoot, "node_modules/vite/dist/node/index.js"));
    const tailwindPath = realpathSync(join(engineClientRoot, "node_modules/@tailwindcss/vite/dist/index.mjs"));
    const [{ build }, { default: tailwindcss }] = await Promise.all([
      import(pathToFileURL(vitePath).href) as Promise<typeof import("vite")>,
      import(pathToFileURL(tailwindPath).href) as Promise<{ default: () => unknown }>,
    ]);
    await build({
      configFile: false,
      root: engineClientRoot,
      plugins: [tailwindcss() as never],
      logLevel: "silent",
      build: {
        emptyOutDir: true,
        outDir: output,
        rollupOptions: { input },
      },
    });

    const assets = join(output, "assets");
    const cssFiles = (await readdir(assets)).filter((filename) => filename.endsWith(".css"));
    assert.equal(cssFiles.length, 1, `Engine visual stylesheet build produced ${cssFiles.length} CSS files`);
    const styles = await readFile(join(assets, cssFiles[0]!), "utf8");
    assert.doesNotMatch(styles, /@(?:import|source)\b/u, "Engine visual stylesheet retained Tailwind directives");
    return styles;
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}
