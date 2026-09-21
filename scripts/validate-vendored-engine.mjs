import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFile, readdir } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";

const baselinePath = "scripts/vendored-engine-baseline.json";

/** Compare only the common snapshot; package-owned overlays have their own source of truth. */
export async function inspectVendoredEngine(root, engineRoot) {
  const rows = [];
  // Installed/build output is not Engine source (notably packages/shared/dist).
  const trackedHostPaths = new Set(
    execFileSync("git", ["ls-files", "-z"], { cwd: engineRoot, encoding: "utf8" }).split("\0"),
  );
  async function visit(relative = "") {
    for (const entry of await readdir(join(root, "sources/engine", relative), { withFileTypes: true })) {
      const path = relative ? `${relative}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        await visit(path);
        continue;
      }
      if (!entry.isFile()) throw new Error(`Unsupported vendored entry: ${path}`);
      const source = await readFile(join(root, "sources/engine", path));
      let host;
      try {
        if (trackedHostPaths.has(path)) host = await readFile(join(engineRoot, path));
      } catch (error) {
        if (error.code !== "ENOENT") throw error;
      }
      const status = !host ? "orphaned" : source.equals(host) ? "current" : "drifted";
      rows.push({
        path,
        status,
        hash: createHash("sha256").update(source).digest("hex"),
        hostHash: host ? createHash("sha256").update(host).digest("hex") : "orphaned",
      });
    }
  }
  // A typo or incomplete checkout must not classify every file as orphaned.
  const manifest = JSON.parse(await readFile(join(engineRoot, "package.json"), "utf8"));
  if (manifest.name !== "marinara-engine") throw new Error("MARINARA_ENGINE_ROOT is not a Marinara Engine checkout");
  await visit();
  return rows.sort((a, b) => a.path.localeCompare(b.path, "en"));
}

export function checkVendoredEngineBaseline(rows, baseline, previous = baseline) {
  const errors = [];
  for (const [path, fingerprint] of Object.entries(baseline)) {
    if (previous[path] !== fingerprint) errors.push(`Baseline may only shrink: ${path}`);
  }
  const outstanding = new Map(rows.filter((row) => row.status !== "current").map((row) => [row.path, row]));
  for (const row of outstanding.values()) {
    if (baseline[row.path] !== `${row.status}:${row.hash}:${row.hostHash}`)
      errors.push(`Unbaselined ${row.status}: ${row.path}`);
  }
  for (const path of Object.keys(baseline)) {
    if (!outstanding.has(path)) errors.push(`Remove resolved baseline entry: ${path}`);
  }
  return errors;
}

async function main() {
  const { values } = parseArgs({ options: { "baseline-ref": { type: "string" } } });
  const root = resolve(import.meta.dirname, "..");
  const engineRoot = process.env.MARINARA_ENGINE_ROOT;
  if (!engineRoot) {
    console.log("Vendored Engine check skipped: set MARINARA_ENGINE_ROOT to an Engine staging checkout.");
    return;
  }
  const baseline = JSON.parse(await readFile(join(root, baselinePath), "utf8"));
  let previous = baseline;
  if (values["baseline-ref"]) {
    const ref = values["baseline-ref"];
    const tracked = execFileSync("git", ["ls-tree", "--name-only", ref, "--", baselinePath], {
      cwd: root,
      encoding: "utf8",
    }).trim();
    if (tracked) {
      previous = JSON.parse(execFileSync("git", ["show", `${ref}:${baselinePath}`], { cwd: root, encoding: "utf8" }));
    } else {
      console.log("Establishing the initial vendored Engine baseline; subsequent PRs may only remove entries.");
    }
  }
  const rows = await inspectVendoredEngine(root, resolve(engineRoot));
  for (const row of rows) console.log(`${row.status.padEnd(8)} ${row.path}`);
  console.log(
    ["current", "drifted", "orphaned"]
      .map((status) => `${rows.filter((row) => row.status === status).length} ${status}`)
      .join(", "),
  );
  const errors = checkVendoredEngineBaseline(rows, baseline, previous);
  if (errors.length) {
    for (const error of errors) console.error(error);
    process.exitCode = 1;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await main();
}
