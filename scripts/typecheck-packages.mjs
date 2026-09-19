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
 * It also reports TS2307 for relative imports, so a moved or deleted package file cannot leave a
 * dangling import behind.
 *
 * Syntax diagnostics (TS1xxx) are reported unconditionally. TypeScript emits no semantic errors for
 * a file it could not parse, so without these a split panel with an unbalanced JSX fragment was
 * reported as clean while every undefined name in it went unmentioned. A syntax error is never
 * acceptable output, so this rule has no allowlist.
 *
 * ponytail: TS2304/TS2552/TS2305, relative TS2307 and all TS1xxx only. Bare specifiers are skipped because
 * the overlay installs no dependencies; widen once the merged tree typechecks against an Engine.
 */
import { cp, mkdtemp, rm } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const engineSources = join(repoRoot, "sources/engine");
const tsc = join(repoRoot, "node_modules/.bin/tsc");
// Node globals resolve through @types/node, which the merged tree does not install.
const IGNORED_NAMES = new Set(["setImmediate", "clearImmediate", "NodeJS"]);
const CODES = /error (TS2304|TS2552): Cannot find name '([^']+)'|error TS2305: /;
const MISSING_MODULE = /^(.+?)\(\d+,\d+\): error TS2307: Cannot find module '(\.{1,2}\/[^']+)'/;
// A file that does not parse yields only TS1xxx, so these must never be filtered or allowlisted.
const SYNTAX = /error TS1\d{3}: /;
// Engine host files the bundler resolves from the real Engine checkout; sources/engine omits them.
const ENGINE_HOST_MODULES = new Set([
  "packages/client/src/components/chat/chat-area.types",
  "packages/client/src/hooks/use-gallery",
  "packages/client/src/lib/agent-failures",
  "packages/server/src/db/connection",
  "packages/server/src/services/prompt-overrides/types",
]);
const isReportedMissingModule = (line) => {
  const match = MISSING_MODULE.exec(line);
  if (!match) return false;
  const target = posix.join(dirname(match[1]), match[2]).replace(/\.js$/, "");
  return !ENGINE_HOST_MODULES.has(target);
};

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

    const lines = [...new Set(output.split("\n"))];
    const found = [
      ...lines.filter((line) => {
        if (!CODES.test(line)) return false;
        const match = CODES.exec(line);
        return !match?.[2] || !IGNORED_NAMES.has(match[2]);
      }),
      ...lines.filter(isReportedMissingModule),
      ...lines.filter((line) => SYNTAX.test(line)),
    ];
    if (found.length > 0) {
      failed = true;
      console.error(`${id}: ${found.length} syntax error(s), undefined name(s) or unresolved module(s)`);
      for (const line of found) console.error(`  ${line}`);
    } else {
      console.log(`${id}: no syntax errors, undefined names or unresolved modules`);
    }
  } finally {
    await rm(overlay, { recursive: true, force: true });
  }
}
process.exit(failed ? 1 : 0);
