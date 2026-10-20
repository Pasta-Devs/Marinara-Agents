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
 * TS2339 on the host adapter types (UIState, ChatState, ... in sources/host-client-overlay) is reported too: a member the
 * adapters do not declare may not exist on the Engine's live store, service or API client a package now uses
 * (Pasta-Devs/Marinara-Agents#1487). Add it to the adapter only once the Engine has it.
 *
 * `games` checks the six turn games' Board and Setup files, which build from sources/engine with no package sources.
 *
 * ponytail: TS2304/TS2552, the missing-export family, TS2339 on the host adapters, relative TS2307 and all TS1xxx only.
 * Bare specifiers are skipped because the overlay installs no dependencies; widen once the merged tree typechecks
 * against an Engine.
 *
 * With MARINARA_ENGINE_ROOT set to an Engine checkout with its dependencies installed, a package in STRICT_RUNS is also
 * checked with `--strict` against that Engine's node_modules, and every diagnostic fails the run. Without the Engine's
 * dependency types a strict run reports about a thousand false errors and hides real ones, so it only runs with an
 * Engine. The Long-Term Memory browser workflow sets one; Pull Request Checks has no Engine checkout and skips it.
 */
import { cp, mkdtemp, rm, symlink } from "node:fs/promises";
import { existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { dirname, join, posix, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(fileURLToPath(new URL("..", import.meta.url)));
const engineSources = join(repoRoot, "sources/engine");
// The overlays the feature build stacks over sources/engine (scripts/build-feature-packages.mjs OVERLAY_ROOTS).
const OVERLAY_ROOTS = [
  "sources/claude-subscription-overlay",
  "sources/host-runtime-overlay",
  "sources/host-client-overlay",
]
  .map((path) => join(repoRoot, path))
  .filter((root) => existsSync(root));
// The turn games have no package sources: their clients are these vendored files and the build's wrapper.
const GAME_FILES = ["Chess", "EightBall", "Poker", "RockPaperScissors", "TicTacToe", "Uno"].flatMap((game) =>
  ["Board", "Setup"].map((part) => `packages/client/src/components/chat/${game}${part}.tsx`),
);
const tsc = join(repoRoot, "node_modules/.bin/tsc");
// Node globals resolve through @types/node, which the merged tree does not install.
const IGNORED_NAMES = new Set(["setImmediate", "clearImmediate", "NodeJS"]);
// The missing-export family. TS2305 is the member that does not exist; TS2459 and TS2724 are the
// member that exists but was never exported; TS2300 is the same name bound twice. Each one
// typechecks nowhere and breaks the esbuild bundle, so the gate must name them here.
const HOST_ADAPTER_TYPES = [
  "UIState",
  "ChatState",
  "AgentState",
  "SidecarState",
  "DialogStoreState",
  "GalleryState",
  "EncounterState",
  "GameStateStore",
  "RollingBackfillState",
  "TTSService",
  "HostApiClient",
];
const HOST_ADAPTER_MEMBER = new RegExp(
  `error TS2339: .* on type '(?:BoundStore<)?(?:${HOST_ADAPTER_TYPES.join("|")})>?'`,
);
const CODES = /error (TS2304|TS2552): Cannot find name '([^']+)'|error (TS2305|TS2459|TS2724|TS2300): /;
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
// Packages whose own sources are clean under strict tsc. Each run checks the package files under its roots; the
// client run uses the Engine client's lib.
const STRICT_RUNS = {
  "long-term-memory": [
    { name: "server and shared", roots: ["packages/server/", "packages/shared/"], lib: [] },
    { name: "client", roots: ["packages/client/"], lib: ["ES2023", "DOM", "DOM.Iterable"] },
  ],
};
const engineRoot = process.env.MARINARA_ENGINE_ROOT ? resolve(process.env.MARINARA_ENGINE_ROOT) : null;
if (engineRoot && !existsSync(join(engineRoot, "node_modules"))) {
  throw new Error(`MARINARA_ENGINE_ROOT has no node_modules; install the Engine's dependencies first: ${engineRoot}`);
}
const COMPILER_ARGS = [
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
];

// Returns the compiler's output, or "" when it reports nothing. A compiler that ran and found errors exits with a
// status and prints them. No status (ENOENT for a missing node_modules/.bin/tsc, a signal) or no output means no
// typecheck happened, which must never read as a clean result.
function runTsc(args, cwd) {
  try {
    execFileSync(tsc, args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 * 1024 * 1024 });
    return "";
  } catch (error) {
    const output = `${error.stdout ?? ""}${error.stderr ?? ""}`;
    if (typeof error.status !== "number" || !output.trim()) {
      throw new Error(`Could not run tsc (${error.code ?? error.signal ?? `exit ${error.status}`}): ${tsc}`, {
        cause: error,
      });
    }
    return output;
  }
}

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
  const packageSources = id === "games" ? null : join(repoRoot, `packages/${id}/src/engine`);
  if (packageSources && !existsSync(packageSources)) throw new Error(`No package-owned source for ${id}`);

  const overlay = await mkdtemp(join(tmpdir(), `marinara-typecheck-${id}-`));
  try {
    await cp(engineSources, overlay, { recursive: true, force: true });
    // Stacked as the bundler stacks them, so package code is checked against the host adapters it is built with.
    for (const root of OVERLAY_ROOTS) await cp(root, overlay, { recursive: true, force: true });
    if (packageSources) await cp(packageSources, overlay, { recursive: true, force: true });

    const sourceFiles = (root) =>
      existsSync(join(root, "packages"))
        ? execFileSync("find", ["packages", "-name", "*.ts", "-o", "-name", "*.tsx"], { cwd: root, encoding: "utf8" })
            .split("\n")
            .filter(Boolean)
        : [];
    const files = packageSources ? sourceFiles(packageSources) : GAME_FILES;
    // Ambient declarations the overlays carry (`marinara:host`) join every run.
    const declarations = OVERLAY_ROOTS.flatMap((root) => sourceFiles(root).filter((file) => file.endsWith(".d.ts")));

    const output = runTsc([...COMPILER_ARGS, ...new Set([...declarations, ...files])], overlay);

    const lines = [...new Set(output.split("\n"))];
    const found = [
      ...lines.filter((line) => HOST_ADAPTER_MEMBER.test(line)),
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

    const strictRuns = STRICT_RUNS[id] ?? [];
    if (strictRuns.length && !engineRoot)
      console.log(`${id}: strict check skipped; set MARINARA_ENGINE_ROOT to run it`);
    if (strictRuns.length && engineRoot) {
      // Resolve bare imports (zod, fastify, react, @types/node) the way the Engine does.
      for (const dir of ["", "packages/client", "packages/server", "packages/shared"]) {
        const modules = join(engineRoot, dir, "node_modules");
        if (existsSync(modules)) await symlink(modules, join(overlay, dir, "node_modules"), "junction");
      }
      for (const run of strictRuns) {
        const ownFiles = files.filter((file) => run.roots.some((root) => file.startsWith(root)));
        if (!ownFiles.length) continue;
        const runFiles = [
          ...declarations.filter((file) => run.roots.some((root) => file.startsWith(root))),
          ...ownFiles,
        ];
        const lib = run.lib.length ? ["--lib", run.lib.join(",")] : [];
        const strictOutput = runTsc([...COMPILER_ARGS, "--strict", "--types", "node", ...lib, ...runFiles], overlay);
        const errors = strictOutput.split("\n").filter((line) => /\berror TS\d+: /.test(line)).length;
        if (strictOutput) {
          failed = true;
          console.error(`${id}: ${errors} strict error(s) in ${run.name} files`);
          console.error(strictOutput.trimEnd());
        } else {
          console.log(`${id}: no strict errors in ${ownFiles.length} ${run.name} files`);
        }
      }
    }
  } finally {
    await rm(overlay, { recursive: true, force: true });
  }
}
process.exit(failed ? 1 : 0);
