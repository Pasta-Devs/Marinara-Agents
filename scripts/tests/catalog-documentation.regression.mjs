import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdir, mkdtemp, readFile, rm, symlink, unlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import {
  buildDocumentationDocument,
  MAX_DOCUMENTATION_BYTES,
  packageDocumentationSchema,
} from "../catalog-documentation.mjs";
import { writeCatalogFamily } from "../catalog-lanes.mjs";

const root = await mkdtemp(join(tmpdir(), "agents-documentation-"));
const entries = (...ids) => ids.map((id) => ({ manifest: { id, version: "1.0.0" } }));
const engine = { source: "engine", path: "agents/avatars.md", heading: "Set up an avatar" };
const config = {
  schemaVersion: 1,
  overview: { source: "package", path: "README.md" },
  guides: [{ id: "avatars", title: "Avatars", ...engine }],
};
async function put(path, content) {
  const target = join(root, path);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, typeof content === "string" ? content : JSON.stringify(content));
}
const build = (...ids) => buildDocumentationDocument(root, "catalog/v3", entries(...ids));

try {
  assert.deepEqual(await build("legacy"), { schemaVersion: 1, packages: {} });
  await put("packages/demo/documentation.json", config);
  await put("packages/demo/README.md", "# Demo\nA maintained user guide.\n");
  await put("packages/another/documentation.json", { schemaVersion: 1, overview: engine });
  const published = await build("demo", "another", "legacy");
  assert.deepEqual(Object.keys(published.packages), ["another", "demo"]);
  assert.deepEqual(published.packages.another, { version: "1.0.0", overview: engine, guides: [] });
  assert.deepEqual(published.packages.demo.guides, [{ id: "avatars", title: "Avatars", ...engine }]);
  assert.deepEqual(published.packages.demo.overview, {
    source: "catalog",
    path: "../../packages/demo/README.md",
    sha256: createHash("sha256").update("# Demo\nA maintained user guide.\n").digest("hex"),
    bytes: 32,
  });
  assert.deepEqual(await build("another", "demo"), published);
  assert.equal(
    (await buildDocumentationDocument(root, "catalog", entries("demo"))).packages.demo.overview.path,
    "../packages/demo/README.md",
  );
  await put("packages/demo/README.md", "Updated guide\n");
  assert.notEqual((await build("demo")).packages.demo.overview.sha256, published.packages.demo.overview.sha256);
  assert.deepEqual(Object.keys((await build("another")).packages), ["another"]);

  const rejected = (value) =>
    assert.equal(packageDocumentationSchema.safeParse(value).success, false, JSON.stringify(value));
  rejected({ ...config, unknown: true });
  rejected({ ...config, overview: { ...engine, executable: true } });
  rejected({ ...config, guides: [{ ...config.guides[0], unknown: true }] });
  rejected({ ...config, guides: [config.guides[0], config.guides[0]] });
  for (const id of ["overview", "Bad", "a".repeat(65)]) rejected({ ...config, guides: [{ ...config.guides[0], id }] });
  rejected({ ...config, guides: Array.from({ length: 33 }, (_, i) => ({ ...config.guides[0], id: `guide-${i}` })) });
  rejected({ ...config, guides: [{ ...config.guides[0], title: " " }] });
  rejected({ ...config, overview: { ...engine, heading: "h".repeat(201) } });
  for (const path of [
    "../README.md",
    "/README.md",
    "C:/README.md",
    "docs\\guide.md",
    "docs/%2e%2e/guide.md",
    "docs/guide.md#x",
    "docs/guide.md?q=1",
    "docs/development/guide.md",
    "client.js",
  ]) {
    rejected({ ...config, overview: { source: "package", path } });
  }
  rejected({ ...config, overview: { source: "engine", path: "development/design.md" } });
  await put("packages/demo/documentation.json", {
    ...config,
    overview: { source: "package", path: "docs/missing.md" },
  });
  await assert.rejects(build("demo"), /missing|ENOENT/);
  await put("packages/demo/documentation.json", config);
  await put("packages/demo/README.md", "a".repeat(MAX_DOCUMENTATION_BYTES + 1));
  await assert.rejects(build("demo"), /1-262144 bytes/);
  await put("packages/demo/documentation.json", " ".repeat(32769));
  await assert.rejects(build("demo"), /1-32768 bytes/);
  await put("packages/demo/documentation.json", "{");
  await assert.rejects(build("demo"), SyntaxError);
  await put("outside/guide.md", "Not package-owned\n");
  await symlink(
    join(root, "outside"),
    join(root, "packages/demo/docs"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await put("packages/demo/documentation.json", { ...config, overview: { source: "package", path: "docs/guide.md" } });
  await assert.rejects(build("demo"), /stay within.*resolving symlinks/i);
  await unlink(join(root, "packages/demo/docs"));
  await put("packages/demo/actual-docs/guide.md", "A guide in the same package\n");
  await symlink(
    join(root, "packages/demo/actual-docs"),
    join(root, "packages/demo/docs"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(build("demo"), /must not use symlinks/);
  await symlink(
    join(root, "packages/another"),
    join(root, "packages/linked"),
    process.platform === "win32" ? "junction" : "dir",
  );
  await assert.rejects(build("linked"), /must not use symlinks/);

  // Real writer: published/preview and v2/v3 visibility, aliases, determinism and removal.
  const laneEntry = (id, min, maxExclusive) => ({
    manifest: { id, name: id, version: "1.0.1", engine: { min, maxExclusive } },
  });
  for (const id of ["v2-only", "v3-only", "modern-life-sim"]) {
    await put(`packages/${id}/documentation.json`, { schemaVersion: 1, overview: engine });
    await put(`packages/${id}/CHANGELOG.md`, "## 1.0.1 — 2026-11-24\n- Initial fixture.\n");
  }
  const catalog = {
    schemaVersion: 1,
    generatedAt: "2026-11-24T00:00:00.000Z",
    packages: [
      laneEntry("v2-only", "2.5.0", "3.0.0"),
      laneEntry("v3-only", "3.0.0", "4.0.0"),
      laneEntry("modern-life-sim", "2.5.0", "4.0.0"),
    ],
  };
  await writeCatalogFamily(root, catalog);
  const json = async (path) => JSON.parse(await readFile(join(root, path), "utf8"));
  assert.deepEqual(Object.keys((await json("catalog/v2/docs.json")).packages), ["v2-only"]);
  assert.deepEqual(Object.keys((await json("catalog/v3/docs.json")).packages), ["v3-only"]);
  assert.deepEqual(Object.keys((await json("catalog/preview/v3/docs.json")).packages), ["modern-life-sim"]);
  assert.deepEqual(await json("catalog/docs.json"), await json("catalog/v2/docs.json"));
  assert.deepEqual(await json("catalog/preview/docs.json"), await json("catalog/preview/v2/docs.json"));
  const before = await readFile(join(root, "catalog/v3/docs.json"), "utf8");
  const originalCatalog = await readFile(join(root, "catalog/v3/catalog.json"), "utf8");
  await writeCatalogFamily(root, catalog);
  assert.equal(await readFile(join(root, "catalog/v3/docs.json"), "utf8"), before);
  await rm(join(root, "packages/v3-only/documentation.json"));
  await writeCatalogFamily(root, catalog);
  await assert.rejects(readFile(join(root, "catalog/v3/docs.json")), { code: "ENOENT" });
  assert.equal(await readFile(join(root, "catalog/v3/catalog.json"), "utf8"), originalCatalog);
  console.log("catalog documentation: OK");
} finally {
  assert.equal(dirname(resolve(root)), resolve(tmpdir()));
  await rm(root, { recursive: true, force: true });
}
