// Replay the narrow, reversible edits on the externally contributed Forge bundle.
// ponytail: this bridges the external source drop; absorb these patches when its source is imported.
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const sourceStart = "/* forge-browser-source:start */\n";
const sourceEnd = "/* forge-browser-source:end */\n";

export async function loadGachaBundlePatches(packageRoot) {
  const ledger = JSON.parse(await readFile(new URL("bundle-patches.json", packageRoot), "utf8"));
  for (const { patches } of Object.values(ledger.files)) {
    for (const { edits } of patches) {
      for (const edit of edits) {
        if (edit.replaceFrom) {
          const source = await readFile(new URL(edit.replaceFrom, packageRoot), "utf8");
          edit.replace = sourceStart + source.replace(/^export /gmu, "") + sourceEnd + edit.find;
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
            if (edit.replaceFrom) {
              // Source edits can regenerate an already built payload without needing its old source file.
              const start = candidate.indexOf(sourceStart);
              const end = candidate.indexOf(sourceEnd, start);
              if (start >= 0 && end >= start) applied = candidate.slice(start, end + sourceEnd.length) + edit.find;
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
