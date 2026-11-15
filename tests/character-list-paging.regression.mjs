// The package copy of the Engine's character hooks drains the character pages (Pasta-Devs/Marinara-Agents#2318).
// Since Pasta-Devs/Marinara-Engine#9114, GET /characters answers one page per call. The vendored `useCharacters` read
// the bare route as the whole library, so its filter threw and every turn-game setup listed character ids. The hook is
// bundled from sources/host-client-overlay the way a feature build stacks it over sources/engine, then its query runs
// against a paged server stand-in.
// Run: node tests/character-list-paging.regression.mjs
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const overlay = join(repoRoot, "sources/host-client-overlay/packages/client/src");
const vendored = join(repoRoot, "sources/engine/packages/client/src");
const esbuild = createRequire(join(repoRoot, "package.json"))("esbuild");

const MARI = "professor-mari";
// CommonJS stand-ins, so every import the list query does not use resolves to undefined instead of failing the bundle.
const standIns = {
  "@tanstack/react-query": `module.exports = {
    useQuery: (options) => options,
    useInfiniteQuery: (options) => options,
    useMutation: (options) => options,
    useQueryClient: () => ({}),
  };`,
  "../lib/api-client": `module.exports = { api: { get: (path) => globalThis.__characterRoute(path) } };`,
  "@marinara-engine/shared": `module.exports = { PROFESSOR_MARI_ID: ${JSON.stringify(MARI)} };`,
};

const built = await esbuild.build({
  entryPoints: [join(overlay, "hooks/use-characters.ts")],
  bundle: true,
  format: "esm",
  platform: "neutral",
  write: false,
  logLevel: "silent",
  plugins: [
    {
      name: "stand-ins",
      setup(build) {
        // The pagination helpers are the vendored Engine copy the feature build uses.
        build.onResolve({ filter: /^\.\.\/lib\/list-pagination$/ }, () => ({
          path: join(vendored, "lib/list-pagination.ts"),
        }));
        build.onResolve({ filter: /.*/ }, (args) =>
          args.kind === "entry-point" || args.importer.endsWith("list-pagination.ts")
            ? undefined
            : { path: args.path, namespace: "stand-in" },
        );
        build.onLoad({ filter: /.*/, namespace: "stand-in" }, (args) => ({
          contents: standIns[args.path] ?? "module.exports = {};",
          loader: "js",
        }));
      },
    },
  ],
});
const { useCharacters } = await import(`data:text/javascript,${encodeURIComponent(built.outputFiles[0].text)}`);

// The Engine since #9114: every call is one page, two cards at a time here, whatever the request asks for.
const library = [{ id: "bo" }, { id: MARI }, { id: "rin" }, { id: "mari-fan" }, { id: "kai" }];
const requests = [];
globalThis.__characterRoute = async (path) => {
  requests.push(path);
  const url = new URL(path, "http://engine.test");
  assert.equal(url.pathname, "/characters");
  const offset = Number(url.searchParams.get("offset") ?? 0);
  const cards =
    url.searchParams.get("includeBuiltIn") === "true" ? library : library.filter((card) => card.id !== MARI);
  const items = cards.slice(offset, offset + 2);
  return { items, limit: 2, offset, hasMore: offset + items.length < cards.length };
};

// ── The list drains every page, under the key the Engine's own list uses ─────────────────────────────────────────
{
  const query = useCharacters(true);
  assert.deepEqual(query.queryKey, ["characters", "list"], "the package shares the Engine's cached list");
  assert.equal(query.enabled, true);
  const characters = await query.queryFn();
  assert.deepEqual(
    characters.map((card) => card.id),
    ["bo", "rin", "mari-fan", "kai"],
    "every page, without Professor Mari",
  );
  assert.ok(
    requests.every((path) => new URL(path, "http://engine.test").searchParams.has("limit")),
    "each read asks for a page, which Engine 2.5.1 and on answer",
  );
  assert.deepEqual(
    requests.map((path) => new URL(path, "http://engine.test").searchParams.get("offset")),
    ["0", "2"],
  );
}

// ── Built-in characters stay in when the caller asks for them ────────────────────────────────────────────────────
{
  requests.length = 0;
  const query = useCharacters({ enabled: false, includeBuiltIn: true });
  assert.deepEqual(query.queryKey, ["characters", "list", "with-built-ins"]);
  assert.equal(query.enabled, false);
  const characters = await query.queryFn();
  assert.deepEqual(
    characters.map((card) => card.id),
    library.map((card) => card.id),
  );
  assert.ok(requests.every((path) => path.includes("includeBuiltIn=true")));
}

// ── A card restamped between two page reads shows up once ────────────────────────────────────────────────────────
{
  const pages = [
    { items: [{ id: "bo" }, { id: "rin" }], limit: 2, offset: 0, hasMore: true },
    { items: [{ id: "rin" }, { id: "kai" }], limit: 2, offset: 2, hasMore: false },
  ];
  globalThis.__characterRoute = async (path) =>
    pages[Number(new URL(path, "http://engine.test").searchParams.get("offset")) / 2];
  const characters = await useCharacters(true).queryFn();
  assert.deepEqual(
    characters.map((card) => card.id),
    ["bo", "rin", "kai"],
  );
}

console.log("character-list paging regression ok");
