// Replay the narrow, reversible edits on the externally contributed Forge bundle.
// ponytail: this bridges the external source drop; absorb these patches when its source is imported.
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";
import { runEsbuild } from "./esbuild-host-plugins.mjs";

function sourceMarkers(edit) {
  const id = edit.sourceId ?? "browser";
  if (!/^[a-z][a-z0-9-]*$/u.test(id)) throw new Error(`Invalid Forge source id: ${id}`);
  return { start: `/* forge-${id}-source:start */\n`, end: `/* forge-${id}-source:end */\n` };
}

export async function loadGachaBundlePatches(packageRoot) {
  const ledger = JSON.parse(await readFile(new URL("bundle-patches.json", packageRoot), "utf8"));
  for (const { patches } of Object.values(ledger.files)) {
    for (const { edits } of patches) {
      for (const edit of edits) {
        if (edit.bundleFrom) {
          // Public shared helpers are bundled at build time, never resolved by an installed package.
          if (!/^[A-Za-z_$][\w$]*$/u.test(edit.bundleName ?? "")) throw new Error("Invalid Forge bundle name");
          const result = await runEsbuild({
            absWorkingDir: resolve(fileURLToPath(new URL("../", import.meta.url))),
            entryPoints: [fileURLToPath(new URL(edit.bundleFrom, packageRoot))],
            bundle: true,
            write: false,
            platform: "node",
            format: "iife",
            globalName: edit.bundleName,
            target: "node24",
            legalComments: "none",
            minifyWhitespace: true,
          });
          const { start, end } = sourceMarkers(edit);
          edit.replace = start + result.outputFiles[0].text + end + edit.find;
        }
        if (edit.replaceFrom) {
          const paths = Array.isArray(edit.replaceFrom) ? edit.replaceFrom : [edit.replaceFrom];
          const sources = await Promise.all(paths.map((path) => readFile(new URL(path, packageRoot), "utf8")));
          const { start, end } = sourceMarkers(edit);
          edit.replace = start + sources.join("\n").replace(/^export /gmu, "") + end + edit.find;
        }
      }
    }
  }
  return ledger;
}

export function swapGachaBundleText(text, from, to) {
  const index = text.indexOf(from);
  if (index === -1 || text.indexOf(from, index + 1) !== -1) {
    throw new Error(`Forge bundle patch anchor must occur once: ${from.slice(0, 100)}`);
  }
  return text.slice(0, index) + to + text.slice(index + from.length);
}

export async function rebuildGachaBundles(packageRoot) {
  const ledger = await loadGachaBundlePatches(packageRoot);
  for (const [path, { base, patches }] of Object.entries(ledger.files)) {
    const file = new URL(path, packageRoot);
    const current = await readFile(file, "utf8");
    let original;
    let firstError;
    // A clean checkout may contain any previously generated prefix of the ledger.
    for (let count = patches.length; count >= 0; count -= 1) {
      try {
        let candidate = current;
        for (const { edits } of patches.slice(0, count).toReversed()) {
          for (const edit of edits.toReversed()) {
            let applied = edit.replace;
            if (edit.replaceFrom || edit.bundleFrom) {
              // Source edits can regenerate an already built payload without needing its old source file.
              const markers = sourceMarkers(edit);
              const start = candidate.indexOf(markers.start);
              const end = candidate.indexOf(markers.end, start);
              if (start >= 0 && end >= start) applied = candidate.slice(start, end + markers.end.length) + edit.find;
            }
            candidate = swapGachaBundleText(candidate, applied, edit.find);
          }
        }
        if (
          Buffer.byteLength(candidate) === base.bytes &&
          createHash("sha256").update(candidate).digest("hex") === base.sha256
        ) {
          original = candidate;
          break;
        }
      } catch (error) {
        // Try the previous generated prefix; an unknown bundle must fail below.
        firstError ??= error;
      }
    }
    if (original === undefined) {
      throw new Error(`Unrecognized Forge bundle ${path}; update its source baseline`, { cause: firstError });
    }
    let result = original;
    for (const { edits } of patches) {
      for (const edit of edits) result = swapGachaBundleText(result, edit.find, edit.replace);
    }
    if (result !== current) await writeFile(file, result);
  }
}
