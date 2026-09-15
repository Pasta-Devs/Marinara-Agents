/**
 * Typecheck package-owned sources against the Engine tree they are compiled into.
 *
 * The feature bundler is esbuild, which strips types without checking them. Four separate
 * defects reached production this way — a route that read a variable belonging to another
 * handler, a component prop that was used but never declared, a hook that was never
 * imported — each of which built clean, passed lint, and threw at runtime.
 *
 * This overlays a package's sources onto the vendored Engine sources exactly as the bundler
 * does, then reports only the errors that mean "this name does not exist". A full typecheck
 * of the merged tree is not clean today, so a narrow, honest check that runs beats a broad
 * one that gets switched off.
 *
 * ponytail: TS2304/TS2552 only. Widen the code list once the merged tree typechecks.
 */
import { cp, mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const engineSources = join(repoRoot, "sources/engine");
const tsc = join(repoRoot, "node_modules/.bin/tsc");
// Node globals resolve through @types/node, which the merged tree does not install.
const IGNORED_NAMES = new Set(["setImmediate", "clearImmediate", "NodeJS"]);
const CODES = /error (TS2304|TS2552): Cannot find name '([^']+)'/;

const packages = process.argv.slice(2);
if (packages.length === 0) packages.push("slurp2");

let failed = false;
for (const id of packages) {
  const packageSources = join(repoRoot, `packages/${id}/src/engine`);
  if (!existsSync(packageSources)) throw new Error(`No package-owned source for ${id}`);

  const overlay = await mkdtemp(join(tmpdir(), `marinara-typecheck-${id}-`));
  try {
    await cp(engineSources, overlay, { recursive: true, force: true });
    await cp(packageSources, overlay, { recursive: true, force: true });

    const files = execFileSync("find", ["packages", "-name", "*.ts", "-o", "-name", "*.tsx"], {
      cwd: packageSources,
      encoding: "utf8",
    })
      .split("\n")
      .filter(Boolean);

    let output = "";
    try {
      execFileSync(
        tsc,
        [
          "--noEmit",
          "--skipLibCheck",
          "--jsx",
          "react-jsx",
          "--target",
          "es2022",
          "--module",
          "esnext",
          "--moduleResolution",
          "bundler",
          ...files,
        ],
        { cwd: overlay, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 },
      );
    } catch (error) {
      output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
    }

    const found = [...new Set(output.split("\n").filter((line) => CODES.test(line)))].filter(
      (line) => !IGNORED_NAMES.has(CODES.exec(line)[2]),
    );
    if (found.length > 0) {
      failed = true;
      console.error(`${id}: ${found.length} undefined name(s)`);
      for (const line of found) console.error(`  ${line}`);
    } else {
      console.log(`${id}: no undefined names`);
    }
  } finally {
    await rm(overlay, { recursive: true, force: true });
  }
}
process.exit(failed ? 1 : 0);
